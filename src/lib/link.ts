import { arrayContentEquals, isDefined } from "@cosmjs/utils";
import { Order, Packet, State } from "cosmjs-types/ibc/core/channel/v1/channel";
import { Height } from "cosmjs-types/ibc/core/client/v1/client";

import {
  AckWithMetadata,
  Endpoint,
  PacketWithMetadata,
  QueryOpts,
} from "./endpoint";
import {
  buildCreateClientArgs,
  ChannelInfo,
  IbcClient,
  prepareChannelHandshake,
  prepareConnectionHandshake,
} from "./ibcclient";
import { Logger, NoopLogger } from "./logger";
import {
  parseAcksFromTxEvents,
  secondsFromDateNanos,
  splitPendingPackets,
  timestampFromDateNanos,
  toIntHeight,
} from "./utils";

/**
 * Many actions on link focus on a src and a dest. Rather than add two functions,
 * we have `Side` to select if we initialize from A or B.
 */
export type Side = "A" | "B";

export function otherSide(side: Side): Side {
  if (side === "A") {
    return "B";
  } else {
    return "A";
  }
}

/**
 * PacketFilter is the type for a function that accepts a Packet and returns a boolean defining whether to relay the packet or not
 */
export type PacketFilter = (packet: Packet) => boolean;

// This records the block heights from the last point where we successfully relayed packets.
// This can be used to optimize the next round of relaying
export interface RelayedHeights {
  packetHeightA?: number;
  packetHeightB?: number;
  ackHeightA?: number;
  ackHeightB?: number;
}

// This is metadata on a round of relaying
export interface RelayInfo {
  packetsFromA: number;
  packetsFromB: number;
  acksFromA: AckWithMetadata[];
  acksFromB: AckWithMetadata[];
}

/**
 * Link represents a Connection between a pair of blockchains (Nodes).
 * An initialized Link requires a both sides to have a Client for the remote side
 * as well as an established Connection using those Clients. Channels can be added
 * and removed to a Link. There are constructors to find/create the basic requirements
 * if you don't know the client/connection IDs a priori.
 */
export class Link {
  public readonly endA: Endpoint;
  public readonly endB: Endpoint;
  public readonly logger: Logger;

  private readonly chainA: string;
  private readonly chainB: string;
  private packetFilter: PacketFilter | null = null;

  private chain(side: Side): string {
    if (side === "A") {
      return this.chainA;
    } else {
      return this.chainB;
    }
  }

  public setFilter(filter: PacketFilter): void {
    this.packetFilter = filter;
  }

  public clearFilter(): void {
    this.packetFilter = null;
  }

  private otherChain(side: Side): string {
    if (side === "A") {
      return this.chainB;
    } else {
      return this.chainA;
    }
  }

  /**
   * findConnection attempts to reuse an existing Client/Connection.
   * If none exists, then it returns an error.
   *
   * @param nodeA
   * @param nodeB
   */
  public static async createWithExistingConnections(
    nodeA: IbcClient,
    nodeB: IbcClient,
    connA: string,
    connB: string,
    logger?: Logger,
  ): Promise<Link> {
    const [chainA, chainB] = [nodeA.chainId, nodeB.chainId];

    const [{ connection: connectionA }, { connection: connectionB }] =
      await Promise.all([
        nodeA.query.ibc.connection.connection(connA),
        nodeB.query.ibc.connection.connection(connB),
      ]);
    if (!connectionA) {
      throw new Error(`[${chainA}] Connection not found for ID ${connA}`);
    }
    if (!connectionB) {
      throw new Error(`[${chainB}] Connection not found for ID ${connB}`);
    }
    if (!connectionA.counterparty) {
      throw new Error(
        `[${chainA}] Counterparty not found for connection with ID ${connA}`,
      );
    }
    if (!connectionB.counterparty) {
      throw new Error(
        `[${chainB}] Counterparty not found for connection with ID ${connB}`,
      );
    }
    // ensure the connection is open
    if (connectionA.state != State.STATE_OPEN) {
      throw new Error(
        `Connection on ${chainA} must be in state open, it has state ${connectionA.state}`,
      );
    }
    if (connectionB.state != State.STATE_OPEN) {
      throw new Error(
        `Connection on ${chainB} must be in state open, it has state ${connectionB.state}`,
      );
    }

    const [clientIdA, clientIdB] = [connectionA.clientId, connectionB.clientId];
    if (clientIdA !== connectionB.counterparty.clientId) {
      throw new Error(
        `Client ID ${connectionA.clientId} for connection with ID ${connA} does not match counterparty client ID ${connectionB.counterparty.clientId} for connection with ID ${connB}`,
      );
    }
    if (clientIdB !== connectionA.counterparty.clientId) {
      throw new Error(
        `Client ID ${connectionB.clientId} for connection with ID ${connB} does not match counterparty client ID ${connectionA.counterparty.clientId} for connection with ID ${connA}`,
      );
    }
    const [clientStateA, clientStateB] = await Promise.all([
      nodeA.query.ibc.client.stateTm(clientIdA),
      nodeB.query.ibc.client.stateTm(clientIdB),
    ]);
    if (nodeA.chainId !== clientStateB.chainId) {
      throw new Error(
        `Chain ID ${nodeA.chainId} for connection with ID ${connA} does not match remote chain ID ${clientStateA.chainId}`,
      );
    }
    if (nodeB.chainId !== clientStateA.chainId) {
      throw new Error(
        `Chain ID ${nodeB.chainId} for connection with ID ${connB} does not match remote chain ID ${clientStateB.chainId}`,
      );
    }

    const endA = new Endpoint(nodeA, clientIdA, connA);
    const endB = new Endpoint(nodeB, clientIdB, connB);
    const link = new Link(endA, endB, logger);

    await Promise.all([
      link.assertHeadersMatchConsensusState(
        "A",
        clientIdA,
        clientStateA.latestHeight,
      ),
      link.assertHeadersMatchConsensusState(
        "B",
        clientIdB,
        clientStateB.latestHeight,
      ),
    ]);

    return link;
  }

  /**
   * we do this assert inside createWithExistingConnections, but it could be a useful check
   * for submitting double-sign evidence later
   *
   * @param proofSide the side holding the consensus proof, we check the header from the other side
   * @param height the height of the consensus state and header we wish to compare
   */
  public async assertHeadersMatchConsensusState(
    proofSide: Side,
    clientId: string,
    height?: Height,
  ): Promise<void> {
    const { src, dest } = this.getEnds(proofSide);

    // Check headers match consensus state (at least validators)
    const [consensusState, header] = await Promise.all([
      src.client.query.ibc.client.consensusStateTm(clientId, height),
      dest.client.header(toIntHeight(height)),
    ]);
    // ensure consensus and headers match for next validator hashes
    if (
      !arrayContentEquals(
        consensusState.nextValidatorsHash,
        header.nextValidatorsHash,
      )
    ) {
      throw new Error(`NextValidatorHash doesn't match ConsensusState.`);
    }
    // ensure the committed apphash matches the actual node we have
    const hash = consensusState.root?.hash;
    if (!hash) {
      throw new Error(`ConsensusState.root.hash missing.`);
    }
    if (!arrayContentEquals(hash, header.appHash)) {
      throw new Error(`AppHash doesn't match ConsensusState.`);
    }
  }

  /**
   * createConnection will always create a new pair of clients and a Connection between the
   * two sides
   *
   * @param nodeA
   * @param nodeB
   */
  public static async createWithNewConnections(
    nodeA: IbcClient,
    nodeB: IbcClient,
    logger?: Logger,
    // number of seconds the client (on B pointing to A) is valid without update
    trustPeriodA?: number | null,
    // number of seconds the client (on A pointing to B) is valid without update
    trustPeriodB?: number | null,
  ): Promise<Link> {
    const [clientIdA, clientIdB] = await createClients(
      nodeA,
      nodeB,
      trustPeriodA,
      trustPeriodB,
    );

    // wait a block to ensure we have proper proofs for creating a connection (this has failed on CI before)
    await Promise.all([nodeA.waitOneBlock(), nodeB.waitOneBlock()]);

    // connectionInit on nodeA
    const { connectionId: connIdA } = await nodeA.connOpenInit(
      clientIdA,
      clientIdB,
    );

    // connectionTry on nodeB
    const proof = await prepareConnectionHandshake(
      nodeA,
      nodeB,
      clientIdA,
      clientIdB,
      connIdA,
    );
    const { connectionId: connIdB } = await nodeB.connOpenTry(clientIdB, proof);

    // connectionAck on nodeA
    const proofAck = await prepareConnectionHandshake(
      nodeB,
      nodeA,
      clientIdB,
      clientIdA,
      connIdB,
    );
    await nodeA.connOpenAck(connIdA, proofAck);

    // connectionConfirm on dest
    const proofConfirm = await prepareConnectionHandshake(
      nodeA,
      nodeB,
      clientIdA,
      clientIdB,
      connIdA,
    );
    await nodeB.connOpenConfirm(connIdB, proofConfirm);

    const endA = new Endpoint(nodeA, clientIdA, connIdA);
    const endB = new Endpoint(nodeB, clientIdB, connIdB);
    return new Link(endA, endB, logger);
  }

  // you can use this if you already have the info out of bounds
  // FIXME: check the validity of that data?
  public constructor(endA: Endpoint, endB: Endpoint, logger?: Logger) {
    this.endA = endA;
    this.endB = endB;
    this.logger = logger ?? new NoopLogger();
    this.chainA = endA.client.chainId;
    this.chainB = endB.client.chainId;
  }

  /**
   * Writes the latest header from the sender chain to the other endpoint
   *
   * @param sender Which side we get the header/commit from
   * @returns header height (from sender) that is now known on dest
   *
   * Relayer binary should call this from a heartbeat which checks if needed and updates.
   * Just needs trusting period on both side
   */
  public async updateClient(sender: Side): Promise<Height> {
    this.logger.info(`Update Client on ${this.otherChain(sender)}`);
    const { src, dest } = this.getEnds(sender);
    const height = await dest.client.doUpdateClient(dest.clientID, src.client);
    return height;
  }

  /**
   * Checks if the last proven header on the destination is older than maxAge,
   * and if so, update the client. Returns the new client height if updated,
   * or null if no update needed
   *
   * @param sender
   * @param maxAge
   */
  public async updateClientIfStale(
    sender: Side,
    maxAge: number,
  ): Promise<Height | null> {
    this.logger.verbose(
      `Checking if ${this.otherChain(sender)} has recent header of ${this.chain(
        sender,
      )}`,
    );
    const { src, dest } = this.getEnds(sender);
    const knownHeader = await dest.client.query.ibc.client.consensusStateTm(
      dest.clientID,
    );
    const currentHeader = await src.client.latestHeader();

    // quit now if we don't need to update
    const knownSeconds = Number(knownHeader.timestamp?.seconds);
    if (knownSeconds) {
      const curSeconds = Number(
        timestampFromDateNanos(currentHeader.time).seconds,
      );
      if (curSeconds - knownSeconds < maxAge) {
        return null;
      }
    }

    // otherwise, do the update
    return this.updateClient(sender);
  }

  /**
   * Ensures the dest has a proof of at least minHeight from source.
   * Will not execute any tx if not needed.
   * Will wait a block if needed until the header is available.
   *
   * Returns the latest header height now available on dest
   */
  public async updateClientToHeight(
    source: Side,
    minHeight: number,
  ): Promise<Height> {
    this.logger.info(
      `Check whether client on ${this.otherChain(
        source,
      )} >= height ${minHeight}`,
    );
    const { src, dest } = this.getEnds(source);
    const client = await dest.client.query.ibc.client.stateTm(dest.clientID);
    // TODO: revisit where revision number comes from - this must be the number from the source chain
    const knownHeight = Number(client.latestHeight?.revisionHeight ?? 0);
    if (knownHeight >= minHeight && client.latestHeight !== undefined) {
      return client.latestHeight;
    }

    const curHeight = (await src.client.latestHeader()).height;
    if (curHeight < minHeight) {
      await src.client.waitOneBlock();
    }
    return this.updateClient(source);
  }

  public async createChannel(
    sender: Side,
    srcPort: string,
    destPort: string,
    ordering: Order,
    version: string,
  ): Promise<ChannelPair> {
    this.logger.info(
      `Create channel with sender ${this.chain(
        sender,
      )}: ${srcPort} => ${destPort}`,
    );
    const { src, dest } = this.getEnds(sender);
    // init on src
    const { channelId: channelIdSrc } = await src.client.channelOpenInit(
      srcPort,
      destPort,
      ordering,
      src.connectionID,
      version,
    );

    // try on dest
    const proof = await prepareChannelHandshake(
      src.client,
      dest.client,
      dest.clientID,
      srcPort,
      channelIdSrc,
    );

    const { channelId: channelIdDest } = await dest.client.channelOpenTry(
      destPort,
      { portId: srcPort, channelId: channelIdSrc },
      ordering,
      dest.connectionID,
      version,
      version,
      proof,
    );

    // ack on src
    const proofAck = await prepareChannelHandshake(
      dest.client,
      src.client,
      src.clientID,
      destPort,
      channelIdDest,
    );
    await src.client.channelOpenAck(
      srcPort,
      channelIdSrc,
      channelIdDest,
      version,
      proofAck,
    );

    // confirm on dest
    const proofConfirm = await prepareChannelHandshake(
      src.client,
      dest.client,
      dest.clientID,
      srcPort,
      channelIdSrc,
    );
    await dest.client.channelOpenConfirm(destPort, channelIdDest, proofConfirm);

    return {
      src: {
        portId: srcPort,
        channelId: channelIdSrc,
      },
      dest: {
        portId: destPort,
        channelId: channelIdDest,
      },
    };
  }

  /**
   * This is a variant of checkAndRelayPacketsAndAcks designed for integration tests.
   * It doesn't have the optimizations of the other variant, as this is designed for low-traffic
   * CI or devnet environments.
   * It does, however, return all the acknowledgements, so we can check for
   */
  public async relayAll(): Promise<RelayInfo> {
    const result = await this.doCheckAndRelay({});
    return result.info;
  }

  /**
   * This will check both sides for pending packets and relay them.
   * It will then relay all acks (previous and generated by the just-submitted packets).
   * If pending packets have timed out, it will submit a timeout instead of attempting to relay them.
   *
   * Returns the most recent heights it relay, which can be used as a start for the next round
   */
  public async checkAndRelayPacketsAndAcks(
    relayFrom: RelayedHeights,
    timedoutThresholdBlocks = 0,
    timedoutThresholdSeconds = 0,
  ): Promise<RelayedHeights> {
    const { heights } = await this.doCheckAndRelay(
      relayFrom,
      timedoutThresholdBlocks,
      timedoutThresholdSeconds,
    );
    this.logger.verbose("next heights to relay", heights as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    return heights;
  }

  protected async doCheckAndRelay(
    relayFrom: RelayedHeights,
    timedoutThresholdBlocks = 0,
    timedoutThresholdSeconds = 0,
  ): Promise<{ heights: RelayedHeights; info: RelayInfo }> {
    // FIXME: is there a cleaner way to get the height we query at?
    const [packetHeightA, packetHeightB, packetsA, packetsB] =
      await Promise.all([
        this.endA.client.currentHeight(),
        this.endB.client.currentHeight(),
        this.getPendingPackets("A", { minHeight: relayFrom.packetHeightA }),
        this.getPendingPackets("B", { minHeight: relayFrom.packetHeightB }),
      ]);

    const filteredPacketsA =
      this.packetFilter !== null
        ? packetsA.filter((packet) => this.packetFilter?.(packet.packet))
        : packetsA;
    const filteredPacketsB =
      this.packetFilter !== null
        ? packetsB.filter((packet) => this.packetFilter?.(packet.packet))
        : packetsB;

    const cutoffHeightA = await this.endB.client.timeoutHeight(
      timedoutThresholdBlocks,
    );
    const cutoffTimeA =
      secondsFromDateNanos(await this.endB.client.currentTime()) +
      timedoutThresholdSeconds;
    const { toSubmit: submitA, toTimeout: timeoutA } = splitPendingPackets(
      cutoffHeightA,
      cutoffTimeA,
      filteredPacketsA,
    );

    const cutoffHeightB = await this.endA.client.timeoutHeight(
      timedoutThresholdBlocks,
    );
    const cutoffTimeB =
      secondsFromDateNanos(await this.endA.client.currentTime()) +
      timedoutThresholdSeconds;
    const { toSubmit: submitB, toTimeout: timeoutB } = splitPendingPackets(
      cutoffHeightB,
      cutoffTimeB,
      filteredPacketsB,
    );

    // FIXME: use the returned acks first? Then query for others?
    await Promise.all([
      this.relayPackets("A", submitA),
      this.relayPackets("B", submitB),
    ]);

    // let's wait a bit to ensure our newly committed acks are indexed
    await Promise.all([
      this.endA.client.waitForIndexer(),
      this.endB.client.waitForIndexer(),
    ]);

    const [ackHeightA, ackHeightB, acksA, acksB] = await Promise.all([
      this.endA.client.currentHeight(),
      this.endB.client.currentHeight(),
      this.getPendingAcks("A", { minHeight: relayFrom.ackHeightA }),
      this.getPendingAcks("B", { minHeight: relayFrom.ackHeightB }),
    ]);

    await Promise.all([this.relayAcks("A", acksA), this.relayAcks("B", acksB)]);

    await Promise.all([
      this.timeoutPackets("A", timeoutA),
      this.timeoutPackets("B", timeoutB),
    ]);

    const heights = {
      packetHeightA,
      packetHeightB,
      ackHeightA,
      ackHeightB,
    };

    const info: RelayInfo = {
      packetsFromA: packetsA.length,
      packetsFromB: packetsB.length,
      acksFromA: acksA,
      acksFromB: acksB,
    };

    return { heights, info };
  }

  public async getPendingPackets(
    source: Side,
    opts: QueryOpts = {},
  ): Promise<PacketWithMetadata[]> {
    this.logger.verbose(`Get pending packets on ${this.chain(source)}`);
    const { src, dest } = this.getEnds(source);
    const allPackets = await src.querySentPackets(opts);

    const toFilter = allPackets.map(({ packet }) => packet);
    const query = async (
      port: string,
      channel: string,
      sequences: readonly number[],
    ) => {
      const res = await dest.client.query.ibc.channel.unreceivedPackets(
        port,
        channel,
        sequences,
      );
      return res.sequences.map((seq) => Number(seq));
    };

    // This gets the subset of packets that were already processed on the receiving chain
    const unreceived = await this.filterUnreceived(toFilter, query, packetId);
    const unreceivedPackets = allPackets.filter(({ packet }) =>
      unreceived[packetId(packet)].has(Number(packet.sequence)),
    );

    // However, some of these may have already been submitted as timeouts on the source chain. Check and filter
    const valid = await Promise.all(
      unreceivedPackets.map(async (packet) => {
        const { sourcePort, sourceChannel, sequence } = packet.packet;
        try {
          // this throws an error if no commitment there
          await src.client.query.ibc.channel.packetCommitment(
            sourcePort,
            sourceChannel,
            sequence,
          );
          return packet;
        } catch {
          return undefined;
        }
      }),
    );
    return valid.filter(isDefined);
  }

  public async getPendingAcks(
    source: Side,
    opts: QueryOpts = {},
  ): Promise<AckWithMetadata[]> {
    this.logger.verbose(`Get pending acks on ${this.chain(source)}`);
    const { src, dest } = this.getEnds(source);
    const allAcks = await src.queryWrittenAcks(opts);
    const filteredAcks =
      this.packetFilter !== null
        ? allAcks.filter((ack) => this.packetFilter?.(ack.originalPacket))
        : allAcks;
    const toFilter = filteredAcks.map(({ originalPacket }) => originalPacket);
    const query = async (
      port: string,
      channel: string,
      sequences: readonly number[],
    ) => {
      const res = await dest.client.query.ibc.channel.unreceivedAcks(
        port,
        channel,
        sequences,
      );
      return res.sequences.map((seq) => Number(seq));
    };
    const unreceived = await this.filterUnreceived(toFilter, query, ackId);

    return filteredAcks.filter(({ originalPacket: packet }) =>
      unreceived[ackId(packet)].has(Number(packet.sequence)),
    );
  }

  private async filterUnreceived(
    packets: Packet[],
    unreceivedQuery: (
      port: string,
      channel: string,
      sequences: readonly number[],
    ) => Promise<number[]>,
    idFunc: (packet: Packet) => string,
  ): Promise<Record<string, Set<number>>> {
    if (packets.length === 0) {
      return {};
    }

    const packetsPerDestination = packets.reduce(
      (sorted: Record<string, readonly number[]>, packet) => {
        const key = idFunc(packet);
        return {
          ...sorted,
          [key]: [...(sorted[key] ?? []), Number(packet.sequence)],
        };
      },
      {},
    );
    const unreceivedResponses = await Promise.all(
      Object.entries(packetsPerDestination).map(
        async ([destination, sequences]) => {
          const [port, channel] = destination.split(idDelim);
          const notfound = await unreceivedQuery(port, channel, sequences);
          return { key: destination, sequences: notfound };
        },
      ),
    );
    const unreceived = unreceivedResponses.reduce(
      (nested: Record<string, Set<number>>, { key, sequences }) => {
        return {
          ...nested,
          [key]: new Set(sequences),
        };
      },
      {},
    );
    return unreceived;
  }

  // Returns the last height that this side knows of the other blockchain
  public async lastKnownHeader(side: Side): Promise<number> {
    this.logger.verbose(`Get last known header on ${this.chain(side)}`);
    const { src } = this.getEnds(side);
    const client = await src.client.query.ibc.client.stateTm(src.clientID);
    return Number(client.latestHeight?.revisionHeight ?? 0);
  }

  // this will update the client if needed and relay all provided packets from src -> dest
  // if packets are all older than the last consensusHeight, then we don't update the client.
  //
  // Returns all the acks that are associated with the just submitted packets
  public async relayPackets(
    source: Side,
    packets: readonly PacketWithMetadata[],
  ): Promise<AckWithMetadata[]> {
    this.logger.info(
      `Relay ${packets.length} packets from ${this.chain(
        source,
      )} => ${this.otherChain(source)}`,
    );
    if (packets.length === 0) {
      return [];
    }
    const { src, dest } = this.getEnds(source);

    // check if we need to update client at all
    const neededHeight = Math.max(...packets.map((x) => x.height)) + 1;
    const headerHeight = await this.updateClientToHeight(source, neededHeight);

    const submit = packets.map(({ packet }) => packet);
    const proofs = await Promise.all(
      submit.map((packet) => src.client.getPacketProof(packet, headerHeight)),
    );
    const { events, height, transactionHash } =
      await dest.client.receivePackets(submit, proofs, headerHeight);
    const acks = parseAcksFromTxEvents(events);
    return acks.map((ack) => ({
      height,
      txHash: transactionHash,
      txEvents: events,
      ...ack,
    }));
  }

  // this will update the client if needed and relay all provided acks from src -> dest
  // (yes, dest is where the packet was sent, but the ack was written on src).
  // if acks are all older than the last consensusHeight, then we don't update the client.
  //
  // Returns the block height the acks were included in, or null if no acks sent
  public async relayAcks(
    source: Side,
    acks: readonly AckWithMetadata[],
  ): Promise<number | null> {
    this.logger.info(
      `Relay ${acks.length} acks from ${this.chain(
        source,
      )} => ${this.otherChain(source)}`,
    );
    if (acks.length === 0) {
      return null;
    }

    const { src, dest } = this.getEnds(source);

    // check if we need to update client at all
    const neededHeight = Math.max(...acks.map((x) => x.height)) + 1;
    const headerHeight = await this.updateClientToHeight(source, neededHeight);

    const proofs = await Promise.all(
      acks.map((ack) => src.client.getAckProof(ack, headerHeight)),
    );
    const { height } = await dest.client.acknowledgePackets(
      acks,
      proofs,
      headerHeight,
    );
    return height;
  }

  // Source: the side that originally sent the packet
  // We need to relay a proof from dest -> source
  public async timeoutPackets(
    source: Side,
    packets: readonly PacketWithMetadata[],
  ): Promise<number | null> {
    this.logger.info(
      `Timeout ${packets.length} packets sent from ${this.chain(source)}`,
    );
    if (packets.length === 0) {
      return null;
    }

    const { src, dest } = this.getEnds(source);
    const destSide = otherSide(source);

    // We need a header that is after the timeout, not after the packet was committed
    // This can get complex with timeout timestamps. Let's just update to latest
    await dest.client.waitOneBlock();
    const headerHeight = await this.updateClient(destSide);

    const rawPackets = packets.map(({ packet }) => packet);
    const proofAndSeqs = await Promise.all(
      rawPackets.map(async (packet) => {
        const fakeAck = {
          originalPacket: packet,
          acknowledgement: new Uint8Array(),
        };
        const { nextSequenceReceive: sequence } =
          await dest.client.query.ibc.channel.nextSequenceReceive(
            packet.destinationPort,
            packet.destinationChannel,
          );
        const proof = await dest.client.getTimeoutProof(fakeAck, headerHeight);
        return { proof, sequence };
      }),
    );
    const proofs = proofAndSeqs.map(({ proof }) => proof);
    const seqs = proofAndSeqs.map(({ sequence }) => sequence);

    const { height } = await src.client.timeoutPackets(
      rawPackets,
      proofs,
      seqs,
      headerHeight,
    );
    return height;
  }

  private getEnds(src: Side): EndpointPair {
    if (src === "A") {
      return {
        src: this.endA,
        dest: this.endB,
      };
    } else {
      return {
        src: this.endB,
        dest: this.endA,
      };
    }
  }
}

const idDelim = ":";
const packetId = (packet: Packet) =>
  `${packet.destinationPort}${idDelim}${packet.destinationChannel}`;
const ackId = (packet: Packet) =>
  `${packet.sourcePort}${idDelim}${packet.sourceChannel}`;

export interface EndpointPair {
  readonly src: Endpoint;
  readonly dest: Endpoint;
}

export interface ChannelPair {
  readonly src: ChannelInfo;
  readonly dest: ChannelInfo;
}

async function createClients(
  nodeA: IbcClient,
  nodeB: IbcClient,
  // number of seconds the client (on B pointing to A) is valid without update
  trustPeriodA?: number | null,
  // number of seconds the client (on A pointing to B) is valid without update
  trustPeriodB?: number | null,
): Promise<string[]> {
  // client on B pointing to A
  const args = await buildCreateClientArgs(nodeA, trustPeriodA);
  const { clientId: clientIdB } = await nodeB.createTendermintClient(
    args.clientState,
    args.consensusState,
  );

  // client on A pointing to B
  const args2 = await buildCreateClientArgs(nodeB, trustPeriodB);
  const { clientId: clientIdA } = await nodeA.createTendermintClient(
    args2.clientState,
    args2.consensusState,
  );

  return [clientIdA, clientIdB];
}
