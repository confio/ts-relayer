import { toAscii } from '@cosmjs/encoding';
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
import { Any } from '../codec/google/protobuf/any';
import { Timestamp } from '../codec/google/protobuf/timestamp';
import { Height } from '../codec/ibc/core/client/v1/client';
import {
  MsgCreateClient,
  MsgUpdateClient,
} from '../codec/ibc/core/client/v1/tx';
import { Version } from '../codec/ibc/core/connection/v1/connection';
import {
  MsgConnectionOpenInit,
  MsgConnectionOpenTry,
} from '../codec/ibc/core/connection/v1/tx';
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

// these are from the cosmos sdk implementation
const defaultMerklePrefix = {
  keyPrefix: toAscii('ibc'),
};
const defaultConnectionVersion: Version = {
  identifier: '1',
  features: ['ORDER_ORDERED', 'ORDER_UNORDERED'],
};
// this is a sane default, but we can revisit it
const defaultDelayPeriod = new Long(0);

function ibcRegistry(): Registry {
  return new Registry([
    ...defaultRegistryTypes,
    ['/ibc.core.client.v1.MsgCreateClient', MsgCreateClient],
    ['/ibc.core.client.v1.MsgUpdateClient', MsgUpdateClient],
  ]);
}

function timestampFromDateNanos(date: ReadonlyDateWithNanoseconds): Timestamp {
  return Timestamp.fromPartial({
    seconds: new Long(date.getTime() / 1000),
    nanos: date.nanoseconds || date.getTime() % 1000,
  });
}

/// This is the default message result with no extra data
export interface MsgResult {
  readonly logs: readonly logs.Log[];
  /** Transaction hash (might be used as transaction ID). Guaranteed to be non-empty upper-case hex */
  readonly transactionHash: string;
}

export type CreateClientResult = MsgResult & {
  readonly clientId: string;
};

export type CreateConnectionResult = MsgResult & {
  readonly connectionId: string;
};

interface ConnectionHandshakeProof {
  clientId: string;
  connectionId: string;
  clientState?: Any;
  proofHeight?: Height;
  // proof of the initialization the connection on Chain A: `UNITIALIZED ->
  // INIT`
  proofInit: Uint8Array;
  // proof of client state included in message
  proofClient: Uint8Array;
  // proof of client consensus state
  proofConsensus: Uint8Array;
  consensusHeight?: Height;
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

  public getChainId(): Promise<string> {
    return this.sign.getChainId();
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
    const commit = Commit.fromPartial({
      height: new Long(rpcHeader.height),
      round: 1, // ???
      blockId: rpcCommit.blockId,
      signatures,
    });
    return { header, commit };
  }

  public async getValidatorSet(height: number): Promise<ValidatorSet> {
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
    return ValidatorSet.fromPartial({
      validators: mappedValidators,
      totalVotingPower: new Long(totalPower),
    });
  }

  // this builds a header to update a remote client.
  // you must pass the last known height on the remote side so we can properly generate it.
  // it will update to the latest state of this chain.
  public async buildHeader(lastHeight: number): Promise<TendermintHeader> {
    const signedHeader = await this.getSignedHeader();
    /* eslint @typescript-eslint/no-non-null-assertion: "off" */
    const curHeight = signedHeader.header!.height.toNumber();
    console.error('header');
    console.error(curHeight);
    console.error(signedHeader.header?.lastBlockId?.hash);
    console.error('commit');
    console.error(signedHeader.commit?.height);
    console.error(signedHeader.commit?.blockId?.hash);
    console.error(signedHeader.header);
    return TendermintHeader.fromPartial({
      signedHeader,
      validatorSet: await this.getValidatorSet(curHeight),
      trustedHeight: {
        revisionHeight: new Long(lastHeight),
        revisionNumber: new Long(0), // TODO
      },
      trustedValidators: await this.getValidatorSet(lastHeight),
    });
  }

  public async getConnectionProof(
    clientId: string,
    connectionId: string
  ): Promise<ConnectionHandshakeProof> {
    // TODO
    const consensusHeight = Height.fromPartial({
      revisionHeight: new Long(123),
    });
    const proofInit = toAscii('TODO');
    const proofConsensus = toAscii('TODO');

    const {
      clientState,
      proof: proofClient,
      proofHeight,
    } = await this.query.ibc.unverified.clientStateWithProof(clientId);

    return {
      clientId,
      connectionId,
      clientState,
      proofHeight,
      proofInit,
      proofClient,
      proofConsensus,
      consensusHeight,
    };
  }

  public async createTendermintClient(
    senderAddress: string,
    clientState: TendermintClientState,
    consensusState: TendermintConsensusState
  ): Promise<CreateClientResult> {
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

  public async connOpenInit(
    senderAddress: string,
    clientId: string,
    remoteClientId: string
  ): Promise<CreateConnectionResult> {
    const createMsg = {
      typeUrl: '/ibc.core.connection.v1.MsgConnectionOpenInit',
      value: MsgConnectionOpenInit.fromPartial({
        clientId,
        counterparty: {
          clientId: remoteClientId,
          prefix: defaultMerklePrefix,
        },
        version: defaultConnectionVersion,
        delayPeriod: defaultDelayPeriod,
        signer: senderAddress,
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
    const connectionId = logs.findAttribute(
      parsedLogs,
      // TODO: they enforce 'message' | 'transfer'
      /* eslint @typescript-eslint/no-explicit-any: "off" */
      'connection_open_init' as any,
      'connection_id'
    ).value;
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      connectionId,
    };
  }

  public async connOpenTry(
    senderAddress: string,
    myClientId: string,
    proof: ConnectionHandshakeProof
  ): Promise<CreateConnectionResult> {
    const {
      clientId,
      connectionId,
      clientState,
      proofHeight,
      proofInit,
      proofClient,
      proofConsensus,
      consensusHeight,
    } = proof;
    const createMsg = {
      typeUrl: '/ibc.core.connection.v1.MsgConnectionOpenTry',
      value: MsgConnectionOpenTry.fromPartial({
        clientId: myClientId,
        counterparty: {
          clientId: clientId,
          connectionId: connectionId,
          prefix: defaultMerklePrefix,
        },
        delayPeriod: defaultDelayPeriod,
        counterpartyVersions: [defaultConnectionVersion],
        signer: senderAddress,
        clientState,
        proofHeight,
        proofInit,
        proofClient,
        proofConsensus,
        consensusHeight,
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
    const myConnectionId = logs.findAttribute(
      parsedLogs,
      // TODO: they enforce 'message' | 'transfer'
      /* eslint @typescript-eslint/no-explicit-any: "off" */
      'connection_open_try' as any,
      'connection_id'
    ).value;
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      connectionId: myConnectionId,
    };
  }
}

export interface CreateClientArgs {
  clientState: TendermintClientState;
  consensusState: TendermintConsensusState;
}

export async function buildCreateClientArgs(
  src: IbcClient,
  unbondingPeriodSec: number,
  trustPeriodSec: number
): Promise<CreateClientArgs> {
  const header = await src.latestHeader();
  const consensusState = buildConsensusState(header);
  const clientState = buildClientState(
    await src.getChainId(),
    unbondingPeriodSec,
    trustPeriodSec,
    header.height
  );
  return { consensusState, clientState };
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
