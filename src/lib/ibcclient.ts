import { toHex } from '@cosmjs/encoding';
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
  ReadonlyDateWithNanoseconds,
  Header as RpcHeader,
  Client as TendermintClient,
} from '@cosmjs/tendermint-rpc';
import Long from 'long';

import { HashOp, LengthOp } from '../codec/confio/proofs';
import { Timestamp } from '../codec/google/protobuf/timestamp';
import {
  MsgCreateClient,
  MsgUpdateClient,
} from '../codec/ibc/core/client/v1/tx';
import {
  ClientState as TendermintClientState,
  ConsensusState as TendermintConsensusState,
  Header as TendermintHeader,
} from '../codec/ibc/lightclients/tendermint/v1/tendermint';
import {
  blockIDFlagFromJSON,
  Commit,
  Header,
  SignedHeader,
} from '../codec/tendermint/types/types';
import { ValidatorSet } from '../codec/tendermint/types/validator';

import { IbcExtension, setupIbcExtension } from './queries/ibc';

function ibcRegistry(): Registry {
  return new Registry([
    ...defaultRegistryTypes,
    ['/ibc.core.client.v1.MsgCreateClient', MsgCreateClient],
    ['/ibc.core.client.v1.MsgUpdateClient', MsgUpdateClient],
  ]);
}

function timestampFromDateNanos(date: ReadonlyDateWithNanoseconds): Timestamp {
  const nanos = (date.getTime() % 1000) * 1000000 + (date.nanoseconds ?? 0);
  return Timestamp.fromPartial({
    seconds: new Long(date.getTime() / 1000),
    nanos,
  });
}

/// This is the default message result with no extra data
export interface MsgResult {
  readonly logs: readonly logs.Log[];
  /** Transaction hash (might be used as transaction ID). Guaranteed to be non-empty upper-case hex */
  readonly transactionHash: string;
}

export type CreateMsgResult = MsgResult & {
  readonly clientId: string;
};

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

  public async latestHeader(): Promise<RpcHeader> {
    const block = await this.tm.block();
    return block.block.header;
  }

  public getCommit(height?: number): Promise<CommitResponse> {
    return this.tm.commit(height);
  }

  public async getSignedHeader(height?: number): Promise<SignedHeader> {
    const { header: rpcHeader, commit: rpcCommit } = await this.getCommit(
      height
    );
    const header = Header.fromPartial({
      ...rpcHeader,
      version: {
        block: new Long(rpcHeader.version.block),
      },
      height: new Long(rpcHeader.height),
      time: timestampFromDateNanos(rpcHeader.time),
      lastBlockId: {
        hash: rpcHeader.lastBlockId.hash,
        partSetHeader: rpcHeader.lastBlockId.parts,
      },
    });

    const signatures = rpcCommit.signatures.map((sig) => ({
      ...sig,
      timestamp: sig.timestamp && timestampFromDateNanos(sig.timestamp),
      blockIdFlag: blockIDFlagFromJSON(sig.blockIdFlag),
    }));
    // debug
    console.error('sig and address');
    signatures.forEach((sig) => {
      console.error(
        `sig: ${sig.signature.length}, addr: ${sig.validatorAddress.length}`
      );
      // TODO: I need nanoseconds here
      console.error(sig.timestamp);
      console.error(toHex(sig.signature));
      console.error(toHex(sig.validatorAddress));
    });

    const commit = Commit.fromPartial({
      height: new Long(rpcCommit.height),
      round: rpcCommit.round,
      blockId: {
        hash: rpcCommit.blockId.hash,
        partSetHeader: rpcCommit.blockId.parts,
      },
      signatures,
    });
    console.error(commit);
    // For the vote sign bytes, it checks (from the commit):
    //   Height, Round, BlockId, TimeStamp, ChainID

    return { header, commit };
  }

  public async getValidatorSet(height: number): Promise<ValidatorSet> {
    // TODO: use header not commit
    // we need to query the header to find out who the proposer was, and pull them out
    const { proposerAddress } = (await this.getCommit(height)).header;
    const validators = await this.tm.validators(height);
    const mappedValidators = validators.validators.map((val) => ({
      address: val.address,
      // TODO: map to handle secp as well (check val.pubkey.type)
      pubKey: val.pubkey
        ? {
            ed25519: val.pubkey.data,
          }
        : undefined,
      votingPower: new Long(val.votingPower),
      proposerPriority: val.proposerPriority
        ? new Long(val.proposerPriority)
        : undefined,
    }));
    const totalPower = validators.validators.reduce(
      (x, v) => x + v.votingPower,
      0
    );
    const proposer = mappedValidators.find(
      (val) => toHex(val.address) === toHex(proposerAddress)
    );
    return ValidatorSet.fromPartial({
      validators: mappedValidators,
      totalVotingPower: new Long(totalPower),
      proposer,
    });
  }

  public getChainId(): Promise<string> {
    return this.sign.getChainId();
  }

  // this builds a header to update a remote client.
  // you must pass the last known height on the remote side so we can properly generate it.
  // it will update to the latest state of this chain.
  //
  // This is the logic that validates the returned struct:
  // ibc check: https://github.com/cosmos/cosmos-sdk/blob/v0.41.0/x/ibc/light-clients/07-tendermint/types/update.go#L87-L167
  // tendermint check: https://github.com/tendermint/tendermint/blob/v0.34.3/light/verifier.go#L19-L79
  // sign bytes: https://github.com/tendermint/tendermint/blob/v0.34.3/types/validator_set.go#L762-L821
  //   * https://github.com/tendermint/tendermint/blob/v0.34.3/types/validator_set.go#L807-L810
  //   * https://github.com/tendermint/tendermint/blob/v0.34.3/types/block.go#L780-L809
  //   * https://github.com/tendermint/tendermint/blob/bf9e36d02d2eb22f6fe8961d0d7d3d34307ba38e/types/canonical.go#L54-L65
  //
  // For the vote sign bytes, it checks (from the commit):
  //   Height, Round, BlockId, TimeStamp, ChainID
  public async buildHeader(lastHeight: number): Promise<TendermintHeader> {
    const signedHeader = await this.getSignedHeader();
    /* eslint @typescript-eslint/no-non-null-assertion: "off" */
    const curHeight = signedHeader.header!.height.toNumber();
    return TendermintHeader.fromPartial({
      signedHeader,
      validatorSet: await this.getValidatorSet(curHeight),
      trustedHeight: {
        revisionHeight: new Long(lastHeight),
      },
      // "assert that trustedVals is NextValidators of last trusted header"
      // https://github.com/cosmos/cosmos-sdk/blob/v0.41.0/x/ibc/light-clients/07-tendermint/types/update.go#L74
      trustedValidators: await this.getValidatorSet(lastHeight + 1),
    });
  }

  public async createTendermintClient(
    senderAddress: string,
    clientState: TendermintClientState,
    consensusState: TendermintConsensusState
  ): Promise<CreateMsgResult> {
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
    const clientId = logs.findAttribute(
      parsedLogs,
      // TODO: they enforce 'message' | 'transfer'
      /* eslint @typescript-eslint/no-explicit-any: "off" */
      'create_client' as any,
      'client_id'
    ).value;
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      clientId,
    };
  }

  public async updateTendermintClient(
    senderAddress: string,
    clientId: string,
    header: TendermintHeader
  ): Promise<MsgResult> {
    const updateMsg = {
      typeUrl: '/ibc.core.client.v1.MsgUpdateClient',
      value: MsgUpdateClient.fromPartial({
        signer: senderAddress,
        clientId,
        header: {
          typeUrl: '/ibc.lightclients.tendermint.v1.Header',
          value: TendermintHeader.encode(header).finish(),
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
      [updateMsg],
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

export function buildConsensusState(
  header: RpcHeader
): TendermintConsensusState {
  return TendermintConsensusState.fromPartial({
    timestamp: timestampFromDateNanos(header.time),
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
