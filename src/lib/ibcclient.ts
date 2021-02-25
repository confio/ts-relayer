import { toAscii } from '@cosmjs/encoding';
import {
  buildFeeTable,
  Coin,
  FeeTable,
  GasLimits,
  GasPrice,
  logs,
  StdFee,
} from '@cosmjs/launchpad';
import { EncodeObject, OfflineSigner, Registry } from '@cosmjs/proto-signing';
import {
  AuthExtension,
  BankExtension,
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
  Header as RpcHeader,
  Client as TendermintClient,
} from '@cosmjs/tendermint-rpc';
import { arrayContentEquals, sleep } from '@cosmjs/utils';
import Long from 'long';

import { Any } from '../codec/google/protobuf/any';
import { MsgTransfer } from '../codec/ibc/applications/transfer/v1/tx';
import { Order, Packet, State } from '../codec/ibc/core/channel/v1/channel';
import {
  MsgAcknowledgement,
  MsgChannelOpenAck,
  MsgChannelOpenConfirm,
  MsgChannelOpenInit,
  MsgChannelOpenTry,
  MsgRecvPacket,
  MsgTimeout,
} from '../codec/ibc/core/channel/v1/tx';
import { Height } from '../codec/ibc/core/client/v1/client';
import {
  MsgCreateClient,
  MsgUpdateClient,
} from '../codec/ibc/core/client/v1/tx';
import { Version } from '../codec/ibc/core/connection/v1/connection';
import {
  MsgConnectionOpenAck,
  MsgConnectionOpenConfirm,
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

import { Logger, NoopLogger } from './logger';
import { IbcExtension, setupIbcExtension } from './queries/ibc';
import {
  Ack,
  buildClientState,
  buildConsensusState,
  createBroadcastTxErrorMessage,
  mapRpcPubKeyToProto,
  multiplyFees,
  timestampFromDateNanos,
  toIntHeight,
  toProtoHeight,
} from './utils';

/**** These are needed to bootstrap the endpoints */
/* Some of them are hardcoded various places, which should we make configurable? */
// const DefaultTrustLevel = '1/3';
// const MaxClockDrift = 10; // 10 seconds
// const upgradePath = ['upgrade', 'upgradedIBCState'];
// const allowUpgradeAfterExpiry = false;
// const allowUpgradeAfterMisbehavior = false;

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
    ['/ibc.core.connection.v1.MsgConnectionOpenInit', MsgConnectionOpenInit],
    ['/ibc.core.connection.v1.MsgConnectionOpenTry', MsgConnectionOpenTry],
    ['/ibc.core.connection.v1.MsgConnectionOpenAck', MsgConnectionOpenAck],
    [
      '/ibc.core.connection.v1.MsgConnectionOpenConfirm',
      MsgConnectionOpenConfirm,
    ],
    ['/ibc.core.channel.v1.MsgChannelOpenInit', MsgChannelOpenInit],
    ['/ibc.core.channel.v1.MsgChannelOpenTry', MsgChannelOpenTry],
    ['/ibc.core.channel.v1.MsgChannelOpenAck', MsgChannelOpenAck],
    ['/ibc.core.channel.v1.MsgChannelOpenConfirm', MsgChannelOpenConfirm],
    ['/ibc.core.channel.v1.MsgRecvPacket', MsgRecvPacket],
    ['/ibc.core.channel.v1.MsgAcknowledgement', MsgAcknowledgement],
    ['/ibc.core.channel.v1.MsgTimeout', MsgTimeout],
    ['/ibc.applications.transfer.v1.MsgTransfer', MsgTransfer],
  ]);
}

/// This is the default message result with no extra data
export interface MsgResult {
  readonly logs: readonly logs.Log[];
  /** Transaction hash (might be used as transaction ID). Guaranteed to be non-empty upper-case hex */
  readonly transactionHash: string;
  /** block height where this transaction was committed - only set if we send 'block' mode */
  readonly height: number;
}

export type CreateClientResult = MsgResult & {
  readonly clientId: string;
};

export type CreateConnectionResult = MsgResult & {
  readonly connectionId: string;
};

export type CreateChannelResult = MsgResult & {
  readonly channelId: string;
};

interface ConnectionHandshakeProof {
  clientId: string;
  connectionId: string;
  clientState?: Any;
  proofHeight: Height;
  // proof of the state of the connection on remote chain
  proofConnection: Uint8Array;
  // proof of client state included in message
  proofClient: Uint8Array;
  // proof of client consensus state
  proofConsensus: Uint8Array;
  // last header height of this chain known by the remote chain
  consensusHeight?: Height;
}

export interface ChannelHandshake {
  id: ChannelInfo;
  proofHeight: Height;
  // proof of the state of the channel on remote chain
  proof: Uint8Array;
}

export interface ChannelInfo {
  readonly portId: string;
  readonly channelId: string;
}

export interface IbcFeeTable extends FeeTable {
  readonly initClient: StdFee;
  readonly updateClient: StdFee;
  readonly initConnection: StdFee;
  readonly connectionHandshake: StdFee;
  readonly initChannel: StdFee;
  readonly channelHandshake: StdFee;
  readonly receivePacket: StdFee;
  readonly ackPacket: StdFee;
  readonly timeoutPacket: StdFee;
  readonly transfer: StdFee;
}

export type IbcClientOptions = SigningStargateClientOptions & {
  gasLimits?: Partial<GasLimits<IbcFeeTable>>;
  logger?: Logger;
};

const defaultGasPrice = GasPrice.fromString('0.025ucosm');
const defaultGasLimits: GasLimits<IbcFeeTable> = {
  initClient: 100000,
  updateClient: 400000,
  initConnection: 100000,
  connectionHandshake: 200000,
  initChannel: 100000,
  channelHandshake: 200000,
  receivePacket: 200000,
  ackPacket: 200000,
  timeoutPacket: 200000,
  transfer: 120000,
};

export class IbcClient {
  public readonly fees: IbcFeeTable;
  public readonly sign: SigningStargateClient;
  public readonly query: QueryClient &
    AuthExtension &
    BankExtension &
    IbcExtension;
  public readonly tm: TendermintClient;
  public readonly senderAddress: string;
  public readonly logger: Logger;

  public static async connectWithSigner(
    endpoint: string,
    signer: OfflineSigner,
    senderAddress: string,
    options: IbcClientOptions = {}
  ): Promise<IbcClient> {
    // override any registry setup, use the other options
    const mergedOptions = {
      ...options,
      registry: ibcRegistry(),
    };
    const signingClient = await SigningStargateClient.connectWithSigner(
      endpoint,
      signer,
      mergedOptions
    );
    const tmClient = await TendermintClient.connect(endpoint, adaptor34);
    return new IbcClient(signingClient, tmClient, senderAddress, options);
  }

  private constructor(
    signingClient: SigningStargateClient,
    tmClient: TendermintClient,
    senderAddress: string,
    options: IbcClientOptions
  ) {
    this.sign = signingClient;
    this.tm = tmClient;
    this.query = QueryClient.withExtensions(
      tmClient,
      setupAuthExtension,
      setupBankExtension,
      setupIbcExtension
    );
    this.senderAddress = senderAddress;
    const { gasPrice = defaultGasPrice, gasLimits = {}, logger } = options;
    this.fees = buildFeeTable<IbcFeeTable>(
      gasPrice,
      defaultGasLimits,
      gasLimits
    );
    this.logger = logger ?? new NoopLogger();
  }

  public getChainId(): Promise<string> {
    this.logger.verbose('Get chain ID');
    return this.sign.getChainId();
  }

  public async latestHeader(): Promise<RpcHeader> {
    this.logger.verbose('Get latest header');
    // TODO: expose header method on tmClient and use that
    const block = await this.tm.block();
    return block.block.header;
  }

  public async header(height: number): Promise<RpcHeader> {
    this.logger.verbose(`Get header for height ${height}`);
    // TODO: expose header method on tmClient and use that
    const resp = await this.tm.blockchain(height, height);
    return resp.blockMetas[0].header;
  }

  public async waitOneBlock(): Promise<void> {
    // TODO: this works but only for websocket connections, is there some code that falls back to polling in cosmjs?
    // await firstEvent(this.tm.subscribeNewBlockHeader());
    await sleep(500);
  }

  // we may have to wait a bit before a tx returns and making queries on the event log
  public async waitForIndexer(): Promise<void> {
    await sleep(50);
  }

  public getCommit(height?: number): Promise<CommitResponse> {
    this.logger.verbose(
      height === undefined
        ? 'Get latest commit'
        : `Get commit for height ${height}`
    );
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
      height: new Long(rpcCommit.height),
      round: rpcCommit.round,
      blockId: {
        hash: rpcCommit.blockId.hash,
        partSetHeader: rpcCommit.blockId.parts,
      },
      signatures,
    });
    // For the vote sign bytes, it checks (from the commit):
    //   Height, Round, BlockId, TimeStamp, ChainID

    return { header, commit };
  }

  public async getValidatorSet(height: number): Promise<ValidatorSet> {
    this.logger.verbose(`Get validator set for height ${height}`);
    // we need to query the header to find out who the proposer was, and pull them out
    const { proposerAddress } = await this.header(height);
    const validators = await this.tm.validators(height);
    const mappedValidators = validators.validators.map((val) => ({
      address: val.address,
      pubKey: mapRpcPubKeyToProto(val.pubkey),
      votingPower: new Long(val.votingPower),
      proposerPriority: val.proposerPriority
        ? new Long(val.proposerPriority)
        : undefined,
    }));
    const totalPower = validators.validators.reduce(
      (x, v) => x + v.votingPower,
      0
    );
    const proposer = mappedValidators.find((val) =>
      arrayContentEquals(val.address, proposerAddress)
    );
    return ValidatorSet.fromPartial({
      validators: mappedValidators,
      totalVotingPower: new Long(totalPower),
      proposer,
    });
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

  // trustedHeight must be proven by the client on the destination chain
  // and include a proof for the connOpenInit (eg. must be 1 or more blocks after the
  // block connOpenInit Tx was in).
  //
  // pass a header height that was previously updated to on the remote chain using updateClient.
  // note: the queries will be for the block before this header, so the proofs match up (appHash is on H+1)
  public async getConnectionProof(
    clientId: string,
    connectionId: string,
    headerHeight: number
  ): Promise<ConnectionHandshakeProof> {
    const queryHeight = headerHeight - 1;

    const {
      clientState,
      proof: proofClient,
      // proofHeight,
    } = await this.query.ibc.proof.client.state(clientId, queryHeight);

    // This is the most recent state we have on this chain of the other
    const {
      latestHeight: consensusHeight,
    } = await this.query.ibc.client.stateTm(clientId);

    // get the init proof
    const {
      proof: proofConnection,
    } = await this.query.ibc.proof.connection.connection(
      connectionId,
      queryHeight
    );

    // get the consensus proof
    const {
      proof: proofConsensus,
    } = await this.query.ibc.proof.client.consensusState(
      clientId,
      toIntHeight(consensusHeight),
      queryHeight
    );

    return {
      clientId,
      clientState,
      connectionId,
      proofHeight: toProtoHeight(headerHeight),
      proofConnection,
      proofClient,
      proofConsensus,
      consensusHeight,
    };
  }

  // trustedHeight must be proven by the client on the destination chain
  // and include a proof for the connOpenInit (eg. must be 1 or more blocks after the
  // block connOpenInit Tx was in).
  //
  // pass a header height that was previously updated to on the remote chain using updateClient.
  // note: the queries will be for the block before this header, so the proofs match up (appHash is on H+1)
  public async getChannelProof(
    id: ChannelInfo,
    headerHeight: number
  ): Promise<ChannelHandshake> {
    const queryHeight = headerHeight - 1;

    const { proof } = await this.query.ibc.proof.channel.channel(
      id.portId,
      id.channelId,
      queryHeight
    );

    return {
      id,
      proofHeight: toProtoHeight(headerHeight),
      proof,
    };
  }

  public async getPacketProof(
    packet: Packet,
    headerHeight: number
  ): Promise<Uint8Array> {
    const queryHeight = headerHeight - 1;

    const { proof } = await this.query.ibc.proof.channel.packetCommitment(
      packet.sourcePort,
      packet.sourceChannel,
      packet.sequence.toNumber(),
      queryHeight
    );

    return proof;
  }

  public async getAckProof(
    { originalPacket }: Ack,
    headerHeight: number
  ): Promise<Uint8Array> {
    const queryHeight = headerHeight - 1;

    const { proof } = await this.query.ibc.proof.channel.packetAcknowledgement(
      originalPacket.destinationPort,
      originalPacket.destinationChannel,
      originalPacket.sequence.toNumber(),
      queryHeight
    );

    return proof;
  }

  /*
  These are helpers to query, build data and submit a message
  Currently all prefixed with doXxx, but please look for better naming
  */

  // Updates existing client on this chain with data from src chain.
  // Returns the height that was updated to.
  public async doUpdateClient(
    clientId: string,
    src: IbcClient
  ): Promise<number> {
    const { latestHeight } = await this.query.ibc.client.stateTm(clientId);
    const header = await src.buildHeader(toIntHeight(latestHeight));
    await this.updateTendermintClient(clientId, header);
    return header.signedHeader?.header?.height?.toNumber() ?? 0;
  }

  /***** These are all direct wrappers around message constructors ********/

  public async sendTokens(
    recipientAddress: string,
    transferAmount: readonly Coin[],
    memo?: string
  ): Promise<MsgResult> {
    this.logger.verbose(`Send tokens to ${recipientAddress}`);
    this.logger.debug('Send tokens:', {
      senderAddress: this.senderAddress,
      recipientAddress,
      transferAmount,
      memo,
    });
    const result = await this.sign.sendTokens(
      this.senderAddress,
      recipientAddress,
      transferAmount,
      memo
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  /* Send any number of messages, you are responsible for encoding them */
  public async sendMultiMsg(
    msgs: EncodeObject[],
    fees: StdFee
  ): Promise<MsgResult> {
    this.logger.verbose(`Broadcast multiple msgs`);
    this.logger.debug(`Multiple msgs:`, {
      msgs,
      fees,
    });
    const senderAddress = this.senderAddress;
    const result = await this.sign.signAndBroadcast(senderAddress, msgs, fees);
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public async createTendermintClient(
    clientState: TendermintClientState,
    consensusState: TendermintConsensusState
  ): Promise<CreateClientResult> {
    this.logger.verbose(`Create Tendermint client`);
    const senderAddress = this.senderAddress;
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
    this.logger.debug('MsgCreateClient', createMsg);

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [createMsg],
      this.fees.initClient
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);

    const clientId = logs.findAttribute(
      parsedLogs,
      'create_client',
      'client_id'
    ).value;
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
      clientId,
    };
  }

  public async updateTendermintClient(
    clientId: string,
    header: TendermintHeader
  ): Promise<MsgResult> {
    this.logger.verbose(`Update Tendermint client ${clientId}`);
    const senderAddress = this.senderAddress;
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
    this.logger.debug(`MsgUpdateClient`, updateMsg);

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [updateMsg],
      this.fees.updateClient
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public async connOpenInit(
    clientId: string,
    remoteClientId: string
  ): Promise<CreateConnectionResult> {
    this.logger.info(`Connection open init: ${clientId} => ${remoteClientId}`);
    const senderAddress = this.senderAddress;
    const msg = {
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
    this.logger.debug(`MsgConnectionOpenInit`, msg);

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      this.fees.initConnection
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    const connectionId = logs.findAttribute(
      parsedLogs,
      'connection_open_init',
      'connection_id'
    ).value;
    this.logger.debug(`Connection open init successful: ${connectionId}`);
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
      connectionId,
    };
  }

  public async connOpenTry(
    myClientId: string,
    proof: ConnectionHandshakeProof
  ): Promise<CreateConnectionResult> {
    this.logger.info(
      `Connection open try: ${myClientId} => ${proof.clientId} (${proof.connectionId})`
    );
    const senderAddress = this.senderAddress;
    const {
      clientId,
      connectionId,
      clientState,
      proofHeight,
      proofConnection: proofInit,
      proofClient,
      proofConsensus,
      consensusHeight,
    } = proof;
    const msg = {
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
    this.logger.debug('MsgConnectionOpenTry', msg);

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      this.fees.connectionHandshake
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    const myConnectionId = logs.findAttribute(
      parsedLogs,
      'connection_open_try',
      'connection_id'
    ).value;
    this.logger.debug(
      `Connection open try successful: ${myConnectionId} => ${connectionId}`
    );
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
      connectionId: myConnectionId,
    };
  }

  public async connOpenAck(
    myConnectionId: string,
    proof: ConnectionHandshakeProof
  ): Promise<MsgResult> {
    this.logger.info(
      `Connection open ack: ${myConnectionId} => ${proof.connectionId}`
    );
    const senderAddress = this.senderAddress;
    const {
      connectionId,
      clientState,
      proofHeight,
      proofConnection: proofTry,
      proofClient,
      proofConsensus,
      consensusHeight,
    } = proof;
    const msg = {
      typeUrl: '/ibc.core.connection.v1.MsgConnectionOpenAck',
      value: MsgConnectionOpenAck.fromPartial({
        connectionId: myConnectionId,
        counterpartyConnectionId: connectionId,
        version: defaultConnectionVersion,
        signer: senderAddress,
        clientState,
        proofHeight,
        proofTry,
        proofClient,
        proofConsensus,
        consensusHeight,
      }),
    };
    this.logger.debug('MsgConnectionOpenAck', msg);

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      this.fees.connectionHandshake
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public async connOpenConfirm(
    proof: ConnectionHandshakeProof
  ): Promise<MsgResult> {
    this.logger.info(`Connection open confirm: ${proof.connectionId}`);
    const senderAddress = this.senderAddress;
    const { connectionId, proofHeight, proofConnection: proofAck } = proof;
    const msg = {
      typeUrl: '/ibc.core.connection.v1.MsgConnectionOpenConfirm',
      value: MsgConnectionOpenConfirm.fromPartial({
        connectionId,
        signer: senderAddress,
        proofHeight,
        proofAck,
      }),
    };
    this.logger.debug('MsgConnectionOpenConfirm', msg);

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      this.fees.connectionHandshake
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public async channelOpenInit(
    portId: string,
    remotePortId: string,
    ordering: Order,
    connectionId: string,
    version: string
  ): Promise<CreateChannelResult> {
    this.logger.verbose(
      `Channel open init: ${portId} => ${remotePortId} (${connectionId})`
    );
    const senderAddress = this.senderAddress;
    const msg = {
      typeUrl: '/ibc.core.channel.v1.MsgChannelOpenInit',
      value: MsgChannelOpenInit.fromPartial({
        portId,
        channel: {
          state: State.STATE_INIT,
          ordering,
          counterparty: {
            portId: remotePortId,
          },
          connectionHops: [connectionId],
          version,
        },
        signer: senderAddress,
      }),
    };
    this.logger.debug('MsgChannelOpenInit', msg);

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      this.fees.initChannel
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    const channelId = logs.findAttribute(
      parsedLogs,
      'channel_open_init',
      'channel_id'
    ).value;
    this.logger.debug(`Channel open init successful: ${channelId}`);
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
      channelId,
    };
  }

  public async channelOpenTry(
    portId: string,
    remote: ChannelInfo,
    ordering: Order,
    connectionId: string,
    version: string,
    counterpartyVersion: string,
    proof: ChannelHandshake
  ): Promise<CreateChannelResult> {
    this.logger.verbose(
      `Channel open try: ${portId} => ${remote.portId} (${remote.channelId})`
    );
    const senderAddress = this.senderAddress;
    const { proofHeight, proof: proofInit } = proof;
    const msg = {
      typeUrl: '/ibc.core.channel.v1.MsgChannelOpenTry',
      value: MsgChannelOpenTry.fromPartial({
        portId,
        counterpartyVersion,
        channel: {
          state: State.STATE_TRYOPEN,
          ordering,
          counterparty: remote,
          connectionHops: [connectionId],
          version,
        },
        proofInit,
        proofHeight,
        signer: senderAddress,
      }),
    };
    this.logger.debug('MsgChannelOpenTry', msg);

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      this.fees.channelHandshake
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    const channelId = logs.findAttribute(
      parsedLogs,
      'channel_open_try',
      'channel_id'
    ).value;
    this.logger.debug(
      `Channel open try successful: ${channelId} => ${remote.channelId})`
    );
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
      channelId,
    };
  }

  public async channelOpenAck(
    portId: string,
    channelId: string,
    counterpartyChannelId: string,
    counterpartyVersion: string,
    proof: ChannelHandshake
  ): Promise<MsgResult> {
    this.logger.verbose(
      `Channel open ack for port ${portId}: ${channelId} => ${counterpartyChannelId}`
    );
    const senderAddress = this.senderAddress;
    const { proofHeight, proof: proofTry } = proof;
    const msg = {
      typeUrl: '/ibc.core.channel.v1.MsgChannelOpenAck',
      value: MsgChannelOpenAck.fromPartial({
        portId,
        channelId,
        counterpartyChannelId,
        counterpartyVersion,
        proofTry,
        proofHeight,
        signer: senderAddress,
      }),
    };
    this.logger.debug('MsgChannelOpenAck', msg);

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      this.fees.channelHandshake
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public async channelOpenConfirm(
    portId: string,
    channelId: string,
    proof: ChannelHandshake
  ): Promise<MsgResult> {
    this.logger.verbose(
      `Chanel open confirm for port ${portId}: ${channelId} => ${proof.id.channelId}`
    );
    const senderAddress = this.senderAddress;
    const { proofHeight, proof: proofAck } = proof;
    const msg = {
      typeUrl: '/ibc.core.channel.v1.MsgChannelOpenConfirm',
      value: MsgChannelOpenConfirm.fromPartial({
        portId,
        channelId,
        proofAck,
        proofHeight,
        signer: senderAddress,
      }),
    };
    this.logger.debug('MsgChannelOpenConfirm', msg);

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      this.fees.channelHandshake
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public receivePacket(
    packet: Packet,
    proofCommitment: Uint8Array,
    proofHeight?: Height
  ): Promise<MsgResult> {
    return this.receivePackets([packet], [proofCommitment], proofHeight);
  }

  public async receivePackets(
    packets: readonly Packet[],
    proofCommitments: readonly Uint8Array[],
    proofHeight?: Height
  ): Promise<MsgResult> {
    this.logger.verbose(`Receive packets (${packets.length})`);
    if (packets.length !== proofCommitments.length) {
      throw new Error(
        `Have ${packets.length} packets, but ${proofCommitments.length} proofs`
      );
    }
    if (packets.length === 0) {
      throw new Error('Must submit at least 1 packet');
    }

    const senderAddress = this.senderAddress;
    const msgs = [];
    for (const i in packets) {
      const msg = {
        typeUrl: '/ibc.core.channel.v1.MsgRecvPacket',
        value: MsgRecvPacket.fromPartial({
          packet: packets[i],
          proofCommitment: proofCommitments[i],
          proofHeight,
          signer: senderAddress,
        }),
      };
      msgs.push(msg);
    }
    this.logger.debug('MsgRecvPacket(s)', { msgs });
    const result = await this.sign.signAndBroadcast(
      senderAddress,
      msgs,
      multiplyFees(this.fees.receivePacket, msgs.length)
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public acknowledgePacket(
    ack: Ack,
    proofAcked: Uint8Array,
    proofHeight?: Height
  ): Promise<MsgResult> {
    return this.acknowledgePackets([ack], [proofAcked], proofHeight);
  }

  public async acknowledgePackets(
    acks: readonly Ack[],
    proofAckeds: readonly Uint8Array[],
    proofHeight?: Height
  ): Promise<MsgResult> {
    this.logger.verbose(`Acknowledge packets (${acks.length})`);
    if (acks.length !== proofAckeds.length) {
      throw new Error(
        `Have ${acks.length} acks, but ${proofAckeds.length} proofs`
      );
    }
    if (acks.length === 0) {
      throw new Error('Must submit at least 1 ack');
    }

    const senderAddress = this.senderAddress;
    const msgs = [];
    for (const i in acks) {
      const msg = {
        typeUrl: '/ibc.core.channel.v1.MsgAcknowledgement',
        value: MsgAcknowledgement.fromPartial({
          packet: acks[i].originalPacket,
          acknowledgement: acks[i].acknowledgement,
          proofAcked: proofAckeds[i],
          proofHeight,
          signer: senderAddress,
        }),
      };
      msgs.push(msg);
    }
    this.logger.debug('MsgAcknowledgement(s)', { msgs });
    const result = await this.sign.signAndBroadcast(
      senderAddress,
      msgs,
      multiplyFees(this.fees.ackPacket, msgs.length)
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public async timeoutPacket(
    packet: Packet,
    proofUnreceived: Uint8Array,
    nextSequenceRecv: Long,
    proofHeight?: Height
  ): Promise<MsgResult> {
    this.logger.verbose(`Timeout packet ${packet.sequence}`);
    const senderAddress = this.senderAddress;
    const msg = {
      typeUrl: '/ibc.core.channel.v1.MsgTimeout',
      value: MsgTimeout.fromPartial({
        packet,
        proofUnreceived,
        nextSequenceRecv,
        proofHeight,
        signer: senderAddress,
      }),
    };
    this.logger.debug('MsgTimeout', msg);
    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      this.fees.timeoutPacket
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public async transferTokens(
    sourcePort: string,
    sourceChannel: string,
    token: Coin,
    receiver: string,
    timeoutBlock?: number,
    timeoutTime?: number
  ): Promise<MsgResult> {
    this.logger.verbose(`Transfer tokens to ${receiver}`);
    const senderAddress = this.senderAddress;
    const timeoutHeight = timeoutBlock
      ? toProtoHeight(timeoutBlock)
      : undefined;
    const timeoutTimestamp = new Long(timeoutTime ?? 0);
    const msg = {
      typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
      value: MsgTransfer.fromPartial({
        sourcePort,
        sourceChannel,
        sender: senderAddress,
        token,
        receiver,
        timeoutHeight,
        timeoutTimestamp,
      }),
    };
    this.logger.debug('MsgTransfer', msg);

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      this.fees.transfer
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    return {
      logs: parsedLogs,
      transactionHash: result.transactionHash,
      height: result.height,
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

export async function prepareConnectionHandshake(
  src: IbcClient,
  dest: IbcClient,
  clientIdSrc: string,
  clientIdDest: string,
  connIdSrc: string
): Promise<ConnectionHandshakeProof> {
  // ensure the last transaction was committed to the header (one block after it was included)
  await src.waitOneBlock();
  // update client on dest
  const headerHeight = await dest.doUpdateClient(clientIdDest, src);
  // get a proof (for the proven height)
  const proof = await src.getConnectionProof(
    clientIdSrc,
    connIdSrc,
    headerHeight
  );
  return proof;
}

export async function prepareChannelHandshake(
  src: IbcClient,
  dest: IbcClient,
  clientIdDest: string,
  portId: string,
  channelId: string
): Promise<ChannelHandshake> {
  // ensure the last transaction was committed to the header (one block after it was included)
  await src.waitOneBlock();
  // update client on dest
  const headerHeight = await dest.doUpdateClient(clientIdDest, src);
  // get a proof (for the proven height)
  const proof = await src.getChannelProof({ portId, channelId }, headerHeight);
  return proof;
}
