import { toAscii, toBase64 } from "@cosmjs/encoding";
import { EncodeObject, OfflineSigner, Registry } from "@cosmjs/proto-signing";
import {
  AuthExtension,
  BankExtension,
  Coin,
  defaultRegistryTypes,
  Event,
  GasPrice,
  isDeliverTxFailure,
  QueryClient,
  setupAuthExtension,
  setupBankExtension,
  setupStakingExtension,
  SigningStargateClient,
  SigningStargateClientOptions,
  StakingExtension,
} from "@cosmjs/stargate";
import {
  comet38,
  CometClient,
  connectComet,
  ReadonlyDateWithNanoseconds,
  tendermint34,
  tendermint37,
} from "@cosmjs/tendermint-rpc";
import { arrayContentEquals, assert, sleep } from "@cosmjs/utils";
import { Any } from "cosmjs-types/google/protobuf/any";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { Order, Packet, State } from "cosmjs-types/ibc/core/channel/v1/channel";
import {
  MsgAcknowledgement,
  MsgChannelOpenAck,
  MsgChannelOpenConfirm,
  MsgChannelOpenInit,
  MsgChannelOpenTry,
  MsgRecvPacket,
  MsgTimeout,
} from "cosmjs-types/ibc/core/channel/v1/tx";
import { Height } from "cosmjs-types/ibc/core/client/v1/client";
import {
  MsgCreateClient,
  MsgUpdateClient,
} from "cosmjs-types/ibc/core/client/v1/tx";
import { Version } from "cosmjs-types/ibc/core/connection/v1/connection";
import {
  MsgConnectionOpenAck,
  MsgConnectionOpenConfirm,
  MsgConnectionOpenInit,
  MsgConnectionOpenTry,
} from "cosmjs-types/ibc/core/connection/v1/tx";
import {
  ClientState as TendermintClientState,
  ConsensusState as TendermintConsensusState,
  Header as TendermintHeader,
} from "cosmjs-types/ibc/lightclients/tendermint/v1/tendermint";
import {
  blockIDFlagFromJSON,
  Commit,
  Header,
  SignedHeader,
} from "cosmjs-types/tendermint/types/types";
import { ValidatorSet } from "cosmjs-types/tendermint/types/validator";

import { Logger, NoopLogger } from "./logger";
import { IbcExtension, setupIbcExtension } from "./queries/ibc";
import {
  Ack,
  buildClientState,
  buildConsensusState,
  createDeliverTxFailureMessage,
  mapRpcPubKeyToProto,
  parseRevisionNumber,
  presentPacketData,
  subtractBlock,
  timestampFromDateNanos,
  toIntHeight,
} from "./utils";

type CometHeader = tendermint34.Header | tendermint37.Header | comet38.Header;
type CometCommitResponse =
  | tendermint34.CommitResponse
  | tendermint37.CommitResponse
  | comet38.CommitResponse;

function deepCloneAndMutate<T extends Record<string, unknown>>(
  object: T,
  mutateFn: (deepClonedObject: T) => void,
): Record<string, unknown> {
  const deepClonedObject = structuredClone(object);
  mutateFn(deepClonedObject);

  return deepClonedObject;
}

function toBase64AsAny(...input: Parameters<typeof toBase64>) {
  return toBase64(...input) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**** These are needed to bootstrap the endpoints */
/* Some of them are hardcoded various places, which should we make configurable? */
// const DefaultTrustLevel = '1/3';
// const MaxClockDrift = 10; // 10 seconds
// const upgradePath = ['upgrade', 'upgradedIBCState'];
// const allowUpgradeAfterExpiry = false;
// const allowUpgradeAfterMisbehavior = false;

// these are from the cosmos sdk implementation
const defaultMerklePrefix = {
  keyPrefix: toAscii("ibc"),
};
const defaultConnectionVersion: Version = {
  identifier: "1",
  features: ["ORDER_ORDERED", "ORDER_UNORDERED"],
};
// this is a sane default, but we can revisit it
const defaultDelayPeriod = 0n;

function ibcRegistry(): Registry {
  return new Registry([
    ...defaultRegistryTypes,
    ["/ibc.core.client.v1.MsgCreateClient", MsgCreateClient],
    ["/ibc.core.client.v1.MsgUpdateClient", MsgUpdateClient],
    ["/ibc.core.connection.v1.MsgConnectionOpenInit", MsgConnectionOpenInit],
    ["/ibc.core.connection.v1.MsgConnectionOpenTry", MsgConnectionOpenTry],
    ["/ibc.core.connection.v1.MsgConnectionOpenAck", MsgConnectionOpenAck],
    [
      "/ibc.core.connection.v1.MsgConnectionOpenConfirm",
      MsgConnectionOpenConfirm,
    ],
    ["/ibc.core.channel.v1.MsgChannelOpenInit", MsgChannelOpenInit],
    ["/ibc.core.channel.v1.MsgChannelOpenTry", MsgChannelOpenTry],
    ["/ibc.core.channel.v1.MsgChannelOpenAck", MsgChannelOpenAck],
    ["/ibc.core.channel.v1.MsgChannelOpenConfirm", MsgChannelOpenConfirm],
    ["/ibc.core.channel.v1.MsgRecvPacket", MsgRecvPacket],
    ["/ibc.core.channel.v1.MsgAcknowledgement", MsgAcknowledgement],
    ["/ibc.core.channel.v1.MsgTimeout", MsgTimeout],
    ["/ibc.applications.transfer.v1.MsgTransfer", MsgTransfer],
  ]);
}

/// This is the default message result with no extra data
export interface MsgResult {
  readonly events: readonly Event[];
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

export type IbcClientOptions = SigningStargateClientOptions & {
  logger?: Logger;
  gasPrice: GasPrice;
  estimatedBlockTime: number;
  estimatedIndexerTime: number;
};
export class IbcClient {
  public readonly gasPrice: GasPrice;
  public readonly sign: SigningStargateClient;
  public readonly query: QueryClient &
    AuthExtension &
    BankExtension &
    IbcExtension &
    StakingExtension;
  public readonly tm: CometClient;
  public readonly senderAddress: string;
  public readonly logger: Logger;

  public readonly chainId: string;
  public readonly revisionNumber: bigint;
  public readonly estimatedBlockTime: number;
  public readonly estimatedIndexerTime: number;

  public static async connectWithSigner(
    endpoint: string,
    signer: OfflineSigner,
    senderAddress: string,
    options: IbcClientOptions,
  ): Promise<IbcClient> {
    // override any registry setup, use the other options
    const mergedOptions = {
      ...options,
      registry: ibcRegistry(),
    };
    const signingClient = await SigningStargateClient.connectWithSigner(
      endpoint,
      signer,
      mergedOptions,
    );
    const tmClient = await connectComet(endpoint);
    const chainId = await signingClient.getChainId();
    return new IbcClient(
      signingClient,
      tmClient,
      senderAddress,
      chainId,
      options,
    );
  }

  private constructor(
    signingClient: SigningStargateClient,
    tmClient: CometClient,
    senderAddress: string,
    chainId: string,
    options: IbcClientOptions,
  ) {
    this.sign = signingClient;
    this.tm = tmClient;
    this.query = QueryClient.withExtensions(
      tmClient,
      setupAuthExtension,
      setupBankExtension,
      setupIbcExtension,
      setupStakingExtension,
    );
    this.senderAddress = senderAddress;
    this.chainId = chainId;
    this.revisionNumber = parseRevisionNumber(chainId);

    this.gasPrice = options.gasPrice;
    this.logger = options.logger ?? new NoopLogger();
    this.estimatedBlockTime = options.estimatedBlockTime;
    this.estimatedIndexerTime = options.estimatedIndexerTime;
  }

  public revisionHeight(height: number): Height {
    return Height.fromPartial({
      revisionHeight: BigInt(height),
      revisionNumber: this.revisionNumber,
    });
  }

  public ensureRevisionHeight(height: number | Height): Height {
    if (typeof height === "number") {
      return Height.fromPartial({
        revisionHeight: BigInt(height),
        revisionNumber: this.revisionNumber,
      });
    }
    if (height.revisionNumber !== this.revisionNumber) {
      throw new Error(
        `Using incorrect revisionNumber ${height.revisionNumber} on chain with ${this.revisionNumber}`,
      );
    }
    return height;
  }

  public async timeoutHeight(blocksInFuture: number): Promise<Height> {
    const header = await this.latestHeader();
    return this.revisionHeight(header.height + blocksInFuture);
  }

  public getChainId(): Promise<string> {
    this.logger.verbose("Get chain ID");
    return this.sign.getChainId();
  }

  public async header(height: number): Promise<CometHeader> {
    this.logger.verbose(`Get header for height ${height}`);
    // TODO: expose header method on tmClient and use that
    const resp = await this.tm.blockchain(height, height);
    return resp.blockMetas[0].header;
  }

  public async latestHeader(): Promise<CometHeader> {
    // TODO: expose header method on tmClient and use that
    const block = await this.tm.block();
    return block.block.header;
  }

  public async currentTime(): Promise<ReadonlyDateWithNanoseconds> {
    // const status = await this.tm.status();
    // return status.syncInfo.latestBlockTime;
    return (await this.latestHeader()).time;
  }

  public async currentHeight(): Promise<number> {
    const status = await this.tm.status();
    return status.syncInfo.latestBlockHeight;
  }

  public async currentRevision(): Promise<Height> {
    const block = await this.currentHeight();
    return this.revisionHeight(block);
  }

  public async waitOneBlock(): Promise<void> {
    // ensure this works
    const start = await this.currentHeight();
    let end: number;
    do {
      await sleep(this.estimatedBlockTime);
      end = await this.currentHeight();
    } while (end === start);
    // TODO: this works but only for websocket connections, is there some code that falls back to polling in cosmjs?
    // await firstEvent(this.tm.subscribeNewBlockHeader());
  }

  // we may have to wait a bit before a tx returns and making queries on the event log
  public async waitForIndexer(): Promise<void> {
    await sleep(this.estimatedIndexerTime);
  }

  public getCommit(height?: number): Promise<CometCommitResponse> {
    this.logger.verbose(
      height === undefined
        ? "Get latest commit"
        : `Get commit for height ${height}`,
    );
    return this.tm.commit(height);
  }

  /** Returns the unbonding period in seconds */
  public async getUnbondingPeriod(): Promise<number> {
    const { params } = await this.query.staking.params();
    const seconds = Number(params?.unbondingTime?.seconds ?? 0);
    if (!seconds) {
      throw new Error("No unbonding period found");
    }
    this.logger.verbose("Queried unbonding period", { seconds });
    return seconds;
  }

  public async getSignedHeader(height?: number): Promise<SignedHeader> {
    const { header: rpcHeader, commit: rpcCommit } =
      await this.getCommit(height);
    const header = Header.fromPartial({
      ...rpcHeader,
      version: {
        block: BigInt(rpcHeader.version.block),
        app: BigInt(rpcHeader.version.app),
      },
      height: BigInt(rpcHeader.height),
      time: timestampFromDateNanos(rpcHeader.time),
      lastBlockId: {
        hash: rpcHeader.lastBlockId?.hash,
        partSetHeader: rpcHeader.lastBlockId?.parts,
      },
    });

    const signatures = rpcCommit.signatures.map((sig) => ({
      ...sig,
      timestamp: sig.timestamp && timestampFromDateNanos(sig.timestamp),
      blockIdFlag: blockIDFlagFromJSON(sig.blockIdFlag),
    }));
    const commit = Commit.fromPartial({
      height: BigInt(rpcCommit.height),
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
    const validators = await this.tm.validatorsAll(height);
    const mappedValidators = validators.validators.map((val) => ({
      address: val.address,
      pubKey: mapRpcPubKeyToProto(val.pubkey),
      votingPower: val.votingPower,
      proposerPriority: val.proposerPriority
        ? BigInt(val.proposerPriority)
        : undefined,
    }));
    const totalPower = validators.validators.reduce(
      (accumulator, v) => accumulator + v.votingPower,
      BigInt(0),
    );
    const proposer = mappedValidators.find((val) =>
      arrayContentEquals(val.address, proposerAddress),
    );
    return ValidatorSet.fromPartial({
      validators: mappedValidators,
      totalVotingPower: totalPower,
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
    // "assert that trustedVals is NextValidators of last trusted header"
    // https://github.com/cosmos/cosmos-sdk/blob/v0.41.0/x/ibc/light-clients/07-tendermint/types/update.go#L74
    const validatorHeight = lastHeight + 1;
    /* eslint @typescript-eslint/no-non-null-assertion: "off" */
    const curHeight = Number(signedHeader.header!.height);
    return TendermintHeader.fromPartial({
      signedHeader,
      validatorSet: await this.getValidatorSet(curHeight),
      trustedHeight: this.revisionHeight(lastHeight),
      trustedValidators: await this.getValidatorSet(validatorHeight),
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
    headerHeight: Height | number,
  ): Promise<ConnectionHandshakeProof> {
    const proofHeight = this.ensureRevisionHeight(headerHeight);
    const queryHeight = subtractBlock(proofHeight, 1n);

    const {
      clientState,
      proof: proofClient,
      // proofHeight,
    } = await this.query.ibc.proof.client.state(clientId, queryHeight);

    // This is the most recent state we have on this chain of the other
    const { latestHeight: consensusHeight } =
      await this.query.ibc.client.stateTm(clientId);
    assert(consensusHeight);

    // get the init proof
    const { proof: proofConnection } =
      await this.query.ibc.proof.connection.connection(
        connectionId,
        queryHeight,
      );

    // get the consensus proof
    const { proof: proofConsensus } =
      await this.query.ibc.proof.client.consensusState(
        clientId,
        consensusHeight,
        queryHeight,
      );

    return {
      clientId,
      clientState,
      connectionId,
      proofHeight,
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
    headerHeight: Height | number,
  ): Promise<ChannelHandshake> {
    const proofHeight = this.ensureRevisionHeight(headerHeight);
    const queryHeight = subtractBlock(proofHeight, 1n);

    const { proof } = await this.query.ibc.proof.channel.channel(
      id.portId,
      id.channelId,
      queryHeight,
    );

    return {
      id,
      proofHeight,
      proof,
    };
  }

  public async getPacketProof(
    packet: Packet,
    headerHeight: Height | number,
  ): Promise<Uint8Array> {
    const proofHeight = this.ensureRevisionHeight(headerHeight);
    const queryHeight = subtractBlock(proofHeight, 1n);

    const { proof } = await this.query.ibc.proof.channel.packetCommitment(
      packet.sourcePort,
      packet.sourceChannel,
      packet.sequence,
      queryHeight,
    );

    return proof;
  }

  public async getAckProof(
    { originalPacket }: Ack,
    headerHeight: Height | number,
  ): Promise<Uint8Array> {
    const proofHeight = this.ensureRevisionHeight(headerHeight);
    const queryHeight = subtractBlock(proofHeight, 1n);

    const res = await this.query.ibc.proof.channel.packetAcknowledgement(
      originalPacket.destinationPort,
      originalPacket.destinationChannel,
      Number(originalPacket.sequence),
      queryHeight,
    );
    const { proof } = res;
    return proof;
  }

  public async getTimeoutProof(
    { originalPacket }: Ack,
    headerHeight: Height | number,
  ): Promise<Uint8Array> {
    const proofHeight = this.ensureRevisionHeight(headerHeight);
    const queryHeight = subtractBlock(proofHeight, 1n);

    const proof = await this.query.ibc.proof.channel.receiptProof(
      originalPacket.destinationPort,
      originalPacket.destinationChannel,
      Number(originalPacket.sequence),
      queryHeight,
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
    src: IbcClient,
  ): Promise<Height> {
    const { latestHeight } = await this.query.ibc.client.stateTm(clientId);
    const header = await src.buildHeader(toIntHeight(latestHeight));
    await this.updateTendermintClient(clientId, header);
    const height = Number(header.signedHeader?.header?.height ?? 0);
    return src.revisionHeight(height);
  }

  /***** These are all direct wrappers around message constructors ********/

  public async sendTokens(
    recipientAddress: string,
    transferAmount: readonly Coin[],
    memo?: string,
  ): Promise<MsgResult> {
    this.logger.verbose(`Send tokens to ${recipientAddress}`);
    this.logger.debug("Send tokens:", {
      senderAddress: this.senderAddress,
      recipientAddress,
      transferAmount,
      memo,
    });
    const result = await this.sign.sendTokens(
      this.senderAddress,
      recipientAddress,
      transferAmount,
      "auto",
      memo,
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }
    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  /* Send any number of messages, you are responsible for encoding them */
  public async sendMultiMsg(msgs: EncodeObject[]): Promise<MsgResult> {
    this.logger.verbose(`Broadcast multiple msgs`);
    this.logger.debug(`Multiple msgs:`, {
      msgs,
    });
    const senderAddress = this.senderAddress;
    const result = await this.sign.signAndBroadcast(
      senderAddress,
      msgs,
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }
    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public async createTendermintClient(
    clientState: TendermintClientState,
    consensusState: TendermintConsensusState,
  ): Promise<CreateClientResult> {
    this.logger.verbose(`Create Tendermint client`);
    const senderAddress = this.senderAddress;
    const createMsg = {
      typeUrl: "/ibc.core.client.v1.MsgCreateClient",
      value: MsgCreateClient.fromPartial({
        signer: senderAddress,
        clientState: {
          typeUrl: "/ibc.lightclients.tendermint.v1.ClientState",
          value: TendermintClientState.encode(clientState).finish(),
        },
        consensusState: {
          typeUrl: "/ibc.lightclients.tendermint.v1.ConsensusState",
          value: TendermintConsensusState.encode(consensusState).finish(),
        },
      }),
    };
    this.logger.debug("MsgCreateClient", createMsg);

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [createMsg],
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }

    const clientId = result.events
      .find((x) => x.type == "create_client")
      ?.attributes.find((x) => x.key == "client_id")?.value;
    if (!clientId) {
      throw new Error("Could not read TX events.");
    }

    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
      clientId,
    };
  }

  public async updateTendermintClient(
    clientId: string,
    header: TendermintHeader,
  ): Promise<MsgResult> {
    this.logger.verbose(`Update Tendermint client ${clientId}`);
    const senderAddress = this.senderAddress;
    const updateMsg = {
      typeUrl: "/ibc.core.client.v1.MsgUpdateClient",
      value: MsgUpdateClient.fromPartial({
        signer: senderAddress,
        clientId,
        clientMessage: {
          typeUrl: "/ibc.lightclients.tendermint.v1.Header",
          value: TendermintHeader.encode(header).finish(),
        },
      }),
    };

    this.logger.debug(
      `MsgUpdateClient`,
      deepCloneAndMutate(updateMsg, (mutableMsg) => {
        if (mutableMsg.value.clientMessage?.value) {
          mutableMsg.value.clientMessage.value = toBase64AsAny(
            mutableMsg.value.clientMessage.value,
          );
        }
      }),
    );

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [updateMsg],
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }
    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public async connOpenInit(
    clientId: string,
    remoteClientId: string,
  ): Promise<CreateConnectionResult> {
    this.logger.info(`Connection open init: ${clientId} => ${remoteClientId}`);
    const senderAddress = this.senderAddress;
    const msg = {
      typeUrl: "/ibc.core.connection.v1.MsgConnectionOpenInit",
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
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }

    const connectionId = result.events
      .find((x) => x.type == "connection_open_init")
      ?.attributes.find((x) => x.key == "connection_id")?.value;
    if (!connectionId) {
      throw new Error("Could not read TX events.");
    }

    this.logger.debug(`Connection open init successful: ${connectionId}`);
    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
      connectionId,
    };
  }

  public async connOpenTry(
    myClientId: string,
    proof: ConnectionHandshakeProof,
  ): Promise<CreateConnectionResult> {
    this.logger.info(
      `Connection open try: ${myClientId} => ${proof.clientId} (${proof.connectionId})`,
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
      typeUrl: "/ibc.core.connection.v1.MsgConnectionOpenTry",
      value: MsgConnectionOpenTry.fromPartial({
        clientId: myClientId,
        counterparty: {
          clientId,
          connectionId,
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
    this.logger.debug(
      "MsgConnectionOpenTry",
      deepCloneAndMutate(msg, (mutableMsg) => {
        mutableMsg.value.proofClient = toBase64AsAny(
          mutableMsg.value.proofClient,
        );
        mutableMsg.value.proofConsensus = toBase64AsAny(
          mutableMsg.value.proofConsensus,
        );
        mutableMsg.value.proofInit = toBase64AsAny(mutableMsg.value.proofInit);
      }),
    );

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }

    const myConnectionId = result.events
      .find((x) => x.type == "connection_open_try")
      ?.attributes.find((x) => x.key == "connection_id")?.value;
    if (!myConnectionId) {
      throw new Error("Could not read TX events.");
    }

    this.logger.debug(
      `Connection open try successful: ${myConnectionId} => ${connectionId}`,
    );
    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
      connectionId: myConnectionId,
    };
  }

  public async connOpenAck(
    myConnectionId: string,
    proof: ConnectionHandshakeProof,
  ): Promise<MsgResult> {
    this.logger.info(
      `Connection open ack: ${myConnectionId} => ${proof.connectionId}`,
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
      typeUrl: "/ibc.core.connection.v1.MsgConnectionOpenAck",
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
    this.logger.debug(
      "MsgConnectionOpenAck",
      deepCloneAndMutate(msg, (mutableMsg) => {
        mutableMsg.value.proofConsensus = toBase64AsAny(
          mutableMsg.value.proofConsensus,
        );
        mutableMsg.value.proofTry = toBase64AsAny(mutableMsg.value.proofTry);
        mutableMsg.value.proofClient = toBase64AsAny(
          mutableMsg.value.proofClient,
        );
      }),
    );

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }
    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public async connOpenConfirm(
    myConnectionId: string,
    proof: ConnectionHandshakeProof,
  ): Promise<MsgResult> {
    this.logger.info(`Connection open confirm: ${myConnectionId}`);
    const senderAddress = this.senderAddress;
    const { proofHeight, proofConnection: proofAck } = proof;
    const msg = {
      typeUrl: "/ibc.core.connection.v1.MsgConnectionOpenConfirm",
      value: MsgConnectionOpenConfirm.fromPartial({
        connectionId: myConnectionId,
        signer: senderAddress,
        proofHeight,
        proofAck,
      }),
    };
    this.logger.debug(
      "MsgConnectionOpenConfirm",
      deepCloneAndMutate(msg, (mutableMsg) => {
        mutableMsg.value.proofAck = toBase64AsAny(mutableMsg.value.proofAck);
      }),
    );

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }
    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public async channelOpenInit(
    portId: string,
    remotePortId: string,
    ordering: Order,
    connectionId: string,
    version: string,
  ): Promise<CreateChannelResult> {
    this.logger.verbose(
      `Channel open init: ${portId} => ${remotePortId} (${connectionId})`,
    );
    const senderAddress = this.senderAddress;
    const msg = {
      typeUrl: "/ibc.core.channel.v1.MsgChannelOpenInit",
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
    this.logger.debug("MsgChannelOpenInit", msg);

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }

    const channelId = result.events
      .find((x) => x.type == "channel_open_init")
      ?.attributes.find((x) => x.key == "channel_id")?.value;
    if (!channelId) {
      throw new Error("Could not read TX events.");
    }

    this.logger.debug(`Channel open init successful: ${channelId}`);
    return {
      events: result.events,
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
    proof: ChannelHandshake,
  ): Promise<CreateChannelResult> {
    this.logger.verbose(
      `Channel open try: ${portId} => ${remote.portId} (${remote.channelId})`,
    );
    const senderAddress = this.senderAddress;
    const { proofHeight, proof: proofInit } = proof;
    const msg = {
      typeUrl: "/ibc.core.channel.v1.MsgChannelOpenTry",
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
    this.logger.debug(
      "MsgChannelOpenTry",
      deepCloneAndMutate(msg, (mutableMsg) => {
        mutableMsg.value.proofInit = toBase64AsAny(mutableMsg.value.proofInit);
      }),
    );

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }

    const channelId = result.events
      .find((x) => x.type == "channel_open_try")
      ?.attributes.find((x) => x.key == "channel_id")?.value;
    if (!channelId) {
      throw new Error("Could not read TX events.");
    }

    this.logger.debug(
      `Channel open try successful: ${channelId} => ${remote.channelId})`,
    );
    return {
      events: result.events,
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
    proof: ChannelHandshake,
  ): Promise<MsgResult> {
    this.logger.verbose(
      `Channel open ack for port ${portId}: ${channelId} => ${counterpartyChannelId}`,
    );
    const senderAddress = this.senderAddress;
    const { proofHeight, proof: proofTry } = proof;
    const msg = {
      typeUrl: "/ibc.core.channel.v1.MsgChannelOpenAck",
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
    this.logger.debug(
      "MsgChannelOpenAck",
      deepCloneAndMutate(msg, (mutableMsg) => {
        mutableMsg.value.proofTry = toBase64AsAny(mutableMsg.value.proofTry);
      }),
    );

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }
    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public async channelOpenConfirm(
    portId: string,
    channelId: string,
    proof: ChannelHandshake,
  ): Promise<MsgResult> {
    this.logger.verbose(
      `Chanel open confirm for port ${portId}: ${channelId} => ${proof.id.channelId}`,
    );
    const senderAddress = this.senderAddress;
    const { proofHeight, proof: proofAck } = proof;
    const msg = {
      typeUrl: "/ibc.core.channel.v1.MsgChannelOpenConfirm",
      value: MsgChannelOpenConfirm.fromPartial({
        portId,
        channelId,
        proofAck,
        proofHeight,
        signer: senderAddress,
      }),
    };
    this.logger.debug(
      "MsgChannelOpenConfirm",
      deepCloneAndMutate(msg, (mutableMsg) => {
        mutableMsg.value.proofAck = toBase64AsAny(mutableMsg.value.proofAck);
      }),
    );

    const result = await this.sign.signAndBroadcast(
      senderAddress,
      [msg],
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }
    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public receivePacket(
    packet: Packet,
    proofCommitment: Uint8Array,
    proofHeight?: Height,
  ): Promise<MsgResult> {
    return this.receivePackets([packet], [proofCommitment], proofHeight);
  }

  public async receivePackets(
    packets: readonly Packet[],
    proofCommitments: readonly Uint8Array[],
    proofHeight?: Height,
  ): Promise<MsgResult> {
    this.logger.verbose(`Receive ${packets.length} packets..`);
    if (packets.length !== proofCommitments.length) {
      throw new Error(
        `Have ${packets.length} packets, but ${proofCommitments.length} proofs`,
      );
    }
    if (packets.length === 0) {
      throw new Error("Must submit at least 1 packet");
    }

    const senderAddress = this.senderAddress;
    const msgs = [];
    for (const i in packets) {
      const packet = packets[i];
      this.logger.verbose(
        `Sending packet #${packet.sequence} from ${this.chainId}:${packet.sourceChannel}`,
        presentPacketData(packet.data),
      );
      const msg = {
        typeUrl: "/ibc.core.channel.v1.MsgRecvPacket",
        value: MsgRecvPacket.fromPartial({
          packet,
          proofCommitment: proofCommitments[i],
          proofHeight,
          signer: senderAddress,
        }),
      };
      msgs.push(msg);
    }
    this.logger.debug("MsgRecvPacket(s)", {
      msgs: msgs.map((msg) =>
        deepCloneAndMutate(msg, (mutableMsg) => {
          mutableMsg.value.proofCommitment = toBase64AsAny(
            mutableMsg.value.proofCommitment,
          );
          if (mutableMsg.value.packet?.data) {
            mutableMsg.value.packet.data = toBase64AsAny(
              mutableMsg.value.packet.data,
            );
          }
        }),
      ),
    });
    const result = await this.sign.signAndBroadcast(
      senderAddress,
      msgs,
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }
    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public acknowledgePacket(
    ack: Ack,
    proofAcked: Uint8Array,
    proofHeight?: Height,
  ): Promise<MsgResult> {
    return this.acknowledgePackets([ack], [proofAcked], proofHeight);
  }

  public async acknowledgePackets(
    acks: readonly Ack[],
    proofAckeds: readonly Uint8Array[],
    proofHeight?: Height,
  ): Promise<MsgResult> {
    this.logger.verbose(`Acknowledge ${acks.length} packets...`);
    if (acks.length !== proofAckeds.length) {
      throw new Error(
        `Have ${acks.length} acks, but ${proofAckeds.length} proofs`,
      );
    }
    if (acks.length === 0) {
      throw new Error("Must submit at least 1 ack");
    }

    const senderAddress = this.senderAddress;
    const msgs = [];
    for (const i in acks) {
      const packet = acks[i].originalPacket;
      const acknowledgement = acks[i].acknowledgement;

      this.logger.verbose(
        `Ack packet #${packet.sequence} from ${this.chainId}:${packet.sourceChannel}`,
        {
          packet: presentPacketData(packet.data),
          ack: presentPacketData(acknowledgement),
        },
      );
      const msg = {
        typeUrl: "/ibc.core.channel.v1.MsgAcknowledgement",
        value: MsgAcknowledgement.fromPartial({
          packet,
          acknowledgement,
          proofAcked: proofAckeds[i],
          proofHeight,
          signer: senderAddress,
        }),
      };
      msgs.push(msg);
    }
    this.logger.debug("MsgAcknowledgement(s)", {
      msgs: msgs.map((msg) =>
        deepCloneAndMutate(msg, (mutableMsg) => {
          mutableMsg.value.acknowledgement = toBase64AsAny(
            mutableMsg.value.acknowledgement,
          );
          mutableMsg.value.proofAcked = toBase64AsAny(
            mutableMsg.value.proofAcked,
          );
          if (mutableMsg.value.packet?.data) {
            mutableMsg.value.packet.data = toBase64AsAny(
              mutableMsg.value.packet.data,
            );
          }
        }),
      ),
    });
    const result = await this.sign.signAndBroadcast(
      senderAddress,
      msgs,
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }
    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public timeoutPacket(
    packet: Packet,
    proofUnreceived: Uint8Array,
    nextSequenceRecv: bigint,
    proofHeight: Height,
  ): Promise<MsgResult> {
    return this.timeoutPackets(
      [packet],
      [proofUnreceived],
      [nextSequenceRecv],
      proofHeight,
    );
  }

  public async timeoutPackets(
    packets: Packet[],
    proofsUnreceived: Uint8Array[],
    nextSequenceRecv: bigint[],
    proofHeight: Height,
  ): Promise<MsgResult> {
    if (packets.length !== proofsUnreceived.length) {
      throw new Error("Packets and proofs must be same length");
    }
    if (packets.length !== nextSequenceRecv.length) {
      throw new Error("Packets and sequences must be same length");
    }

    this.logger.verbose(`Timeout ${packets.length} packets...`);
    const senderAddress = this.senderAddress;

    const msgs = [];
    for (const i in packets) {
      const packet = packets[i];
      this.logger.verbose(
        `Timeout packet #${packet.sequence} from ${this.chainId}:${packet.sourceChannel}`,
        presentPacketData(packet.data),
      );

      const msg = {
        typeUrl: "/ibc.core.channel.v1.MsgTimeout",
        value: MsgTimeout.fromPartial({
          packet,
          proofUnreceived: proofsUnreceived[i],
          nextSequenceRecv: nextSequenceRecv[i],
          proofHeight,
          signer: senderAddress,
        }),
      };
      msgs.push(msg);
    }

    this.logger.debug("MsgTimeout", {
      msgs: msgs.map((msg) =>
        deepCloneAndMutate(msg, (mutableMsg) => {
          if (mutableMsg.value.packet?.data) {
            mutableMsg.value.packet.data = toBase64AsAny(
              mutableMsg.value.packet.data,
            );
          }
          mutableMsg.value.proofUnreceived = toBase64AsAny(
            mutableMsg.value.proofUnreceived,
          );
        }),
      ),
    });
    const result = await this.sign.signAndBroadcast(
      senderAddress,
      msgs,
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }
    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }

  public async transferTokens(
    sourcePort: string,
    sourceChannel: string,
    token: Coin,
    receiver: string,
    timeoutHeight?: Height,
    /** timeout in seconds (SigningStargateClient converts to nanoseconds) */
    timeoutTime?: number,
  ): Promise<MsgResult> {
    this.logger.verbose(`Transfer tokens to ${receiver}`);
    const result = await this.sign.sendIbcTokens(
      this.senderAddress,
      receiver,
      token,
      sourcePort,
      sourceChannel,
      timeoutHeight,
      timeoutTime,
      "auto",
    );
    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxFailureMessage(result));
    }
    return {
      events: result.events,
      transactionHash: result.transactionHash,
      height: result.height,
    };
  }
}

export interface CreateClientArgs {
  clientState: TendermintClientState;
  consensusState: TendermintConsensusState;
}

// this will query for the unbonding period.
// if the trusting period is not set, it will use 2/3 of the unbonding period
export async function buildCreateClientArgs(
  src: IbcClient,
  trustPeriodSec?: number | null,
): Promise<CreateClientArgs> {
  const header = await src.latestHeader();
  const consensusState = buildConsensusState(header);
  const unbondingPeriodSec = await src.getUnbondingPeriod();
  if (trustPeriodSec === undefined || trustPeriodSec === null) {
    trustPeriodSec = Math.floor((unbondingPeriodSec * 2) / 3);
  }
  const clientState = buildClientState(
    src.chainId,
    unbondingPeriodSec,
    trustPeriodSec,
    src.revisionHeight(header.height),
  );
  return { consensusState, clientState };
}

export async function prepareConnectionHandshake(
  src: IbcClient,
  dest: IbcClient,
  clientIdSrc: string,
  clientIdDest: string,
  connIdSrc: string,
): Promise<ConnectionHandshakeProof> {
  // ensure the last transaction was committed to the header (one block after it was included)
  await src.waitOneBlock();
  // update client on dest
  const headerHeight = await dest.doUpdateClient(clientIdDest, src);

  // get a proof (for the proven height)
  const proof = await src.getConnectionProof(
    clientIdSrc,
    connIdSrc,
    headerHeight,
  );
  return proof;
}

export async function prepareChannelHandshake(
  src: IbcClient,
  dest: IbcClient,
  clientIdDest: string,
  portId: string,
  channelId: string,
): Promise<ChannelHandshake> {
  // ensure the last transaction was committed to the header (one block after it was included)
  await src.waitOneBlock();
  // update client on dest
  const headerHeight = await dest.doUpdateClient(clientIdDest, src);
  // get a proof (for the proven height)
  const proof = await src.getChannelProof({ portId, channelId }, headerHeight);
  return proof;
}
