import { coins, logs, StdFee } from '@cosmjs/launchpad';
import { OfflineSigner, Registry } from '@cosmjs/proto-signing';
import {
  AuthExtension,
  BankExtension,
  BroadcastTxFailure,
  defaultRegistryTypes,
  isBroadcastTxFailure,
  parseRawLog,
  QueryClient,
  setupAuthExtension,
  setupBankExtension,
  SigningStargateClient,
  SigningStargateClientOptions,
} from '@cosmjs/stargate';
import {
  adaptor34,
  CommitResponse,
  Header,
  Client as TendermintClient,
} from '@cosmjs/tendermint-rpc';
import Long from 'long';

import { HashOp, LengthOp } from '../codec/confio/proofs';
import {
  MsgCreateClient,
  MsgUpdateClient,
} from '../codec/ibc/core/client/v1/tx';
import {
  ClientState as TendermintClientState,
  ConsensusState as TendermintConsensusState,
} from '../codec/ibc/lightclients/tendermint/v1/tendermint';

import { IbcExtension, setupIbcExtension } from './queries/ibc';

function ibcRegistry(): Registry {
  return new Registry([
    ...defaultRegistryTypes,
    ['/ibc.core.client.v1.MsgCreateClient', MsgCreateClient],
    ['/ibc.core.client.v1.MsgUpdateClient', MsgUpdateClient],
  ]);
}

/// This is the default message result with no extra data
export interface MsgResult {
  readonly logs: readonly logs.Log[];
  /** Transaction hash (might be used as transaction ID). Guaranteed to be non-empty upper-case hex */
  readonly transactionHash: string;
}

function createBroadcastTxErrorMessage(result: BroadcastTxFailure): string {
  return `Error when broadcasting tx ${result.transactionHash} at height ${result.height}. Code: ${result.code}; Raw log: ${result.rawLog}`;
}

export class IbcClient {
  public readonly sign: SigningStargateClient;
  public readonly query: QueryClient &
    AuthExtension &
    BankExtension &
    IbcExtension;
  public readonly tm: TendermintClient;

  public static async connectWithSigner(
    endpoint: string,
    signer: OfflineSigner,
    options?: SigningStargateClientOptions
  ): Promise<IbcClient> {
    // override any registry setup, use the other options
    const registryOptions = { ...options, registry: ibcRegistry() };
    const signingClient = await SigningStargateClient.connectWithSigner(
      endpoint,
      signer,
      registryOptions
    );
    const tmClient = await TendermintClient.connect(endpoint, adaptor34);
    return new IbcClient(signingClient, tmClient);
  }

  private constructor(
    signingClient: SigningStargateClient,
    tmClient: TendermintClient
  ) {
    this.sign = signingClient;
    this.tm = tmClient;
    this.query = QueryClient.withExtensions(
      tmClient,
      setupAuthExtension,
      setupBankExtension,
      setupIbcExtension
    );
  }

  public async latestHeader(): Promise<Header> {
    const block = await this.tm.block();
    return block.block.header;
  }

  public getCommit(height?: number): Promise<CommitResponse> {
    return this.tm.commit(height);
  }

  public getChainId(): Promise<string> {
    return this.sign.getChainId();
  }

  public async createTendermintClient(
    senderAddress: string,
    clientState: TendermintClientState,
    consensusState: TendermintConsensusState
  ): Promise<MsgResult> {
    const createMsg = {
      typeUrl: '/ibc.core.client.v1.MsgCreateClient',
      value: MsgCreateClient.fromPartial({
        signer: senderAddress,
        clientState: {
          typeUrl: '/ibc.lightclients.tendermint.v1.ClientState',
          value: TendermintClientState.encode(clientState).finish(),
        },
        consensusState: {
          typeUrl: '/ibc.lightclients.tendermint.v1.ConsensusState',
          value: TendermintConsensusState.encode(consensusState).finish(),
        },
      }),
    };

    // TODO: use lookup table, proper values here
    const fee: StdFee = {
      amount: coins(5000, 'ucosm'),
      gas: '1000000',
    };

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [createMsg],
      fee
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    // const contractAddressAttr = logs.findAttribute(
    //   parsedLogs,
    //   'message',
    //   'contract_address'
    // );
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
    };
  }
}

export function buildConsensusState(header: Header): TendermintConsensusState {
  return TendermintConsensusState.fromPartial({
    timestamp: new Date(header.time.getMilliseconds()),
    root: {
      hash: header.appHash,
    },
    nextValidatorsHash: header.nextValidatorsHash,
  });
}

// Note: we hardcode a number of assumptions, like trust level, clock drift, and assume revisionNumber is 1
export function buildClientState(
  chainId: string,
  unbondingPeriodSec: number,
  trustPeriodSec: number,
  height: number
): TendermintClientState {
  // Copied here until https://github.com/confio/ics23/issues/36 is resolved
  // https://github.com/confio/ics23/blob/master/js/src/proofs.ts#L11-L26
  const iavlSpec = {
    leafSpec: {
      prefix: Uint8Array.from([0]),
      hash: HashOp.SHA256,
      prehashValue: HashOp.SHA256,
      prehashKey: HashOp.NO_HASH,
      length: LengthOp.VAR_PROTO,
    },
    innerSpec: {
      childOrder: [0, 1],
      minPrefixLength: 4,
      maxPrefixLength: 12,
      childSize: 33,
      hash: HashOp.SHA256,
    },
  };
  const tendermintSpec = {
    leafSpec: {
      prefix: Uint8Array.from([0]),
      hash: HashOp.SHA256,
      prehashValue: HashOp.SHA256,
      prehashKey: HashOp.NO_HASH,
      length: LengthOp.VAR_PROTO,
    },
    innerSpec: {
      childOrder: [0, 1],
      minPrefixLength: 1,
      maxPrefixLength: 1,
      childSize: 32,
      hash: HashOp.SHA256,
    },
  };

  return TendermintClientState.fromPartial({
    chainId,
    trustLevel: {
      numerator: Long.fromInt(1),
      denominator: Long.fromInt(3),
    },
    unbondingPeriod: {
      seconds: new Long(unbondingPeriodSec),
    },
    trustingPeriod: {
      seconds: new Long(trustPeriodSec),
    },
    maxClockDrift: {
      seconds: new Long(20),
    },
    latestHeight: {
      revisionNumber: new Long(0), // ??
      revisionHeight: new Long(height),
    },
    proofSpecs: [iavlSpec, tendermintSpec],
    upgradePath: ['upgrade', 'upgradedIBCState'],
    allowUpdateAfterExpiry: false,
    allowUpdateAfterMisbehaviour: false,
  });
}
