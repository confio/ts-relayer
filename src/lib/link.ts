import { arrayContentEquals } from '@cosmjs/utils';

import { Order, State } from '../codec/ibc/core/channel/v1/channel';

import { Endpoint, PacketWithMetadata, QueryOpts } from './endpoint';
import {
  buildCreateClientArgs,
  ChannelInfo,
  IbcClient,
  prepareChannelHandshake,
  prepareConnectionHandshake,
} from './ibcclient';
import { toIntHeight } from './utils';

/**
 * Many actions on link focus on a src and a dest. Rather than add two functions,
 * we have `Side` to select if we initialize from A or B.
 */
export type Side = 'A' | 'B';

// measured in seconds
// Note: client parameter is checked against the actual keeper - must use real values from genesis.json
// TODO: make this more adaptable for chains (query from staking?)
const genesisUnbondingTime = 1814400;

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
    connB: string
  ): Promise<Link> {
    const [
      { connection: connectionA },
      { connection: connectionB },
    ] = await Promise.all([
      nodeA.query.ibc.connection.connection(connA),
      nodeB.query.ibc.connection.connection(connB),
    ]);
    if (!connectionA) {
      throw new Error(`Connection not found for ID ${connA}`);
    }
    if (!connectionB) {
      throw new Error(`Connection not found for ID ${connB}`);
    }
    if (!connectionA.counterparty) {
      throw new Error(`Counterparty not found for connection with ID ${connA}`);
    }
    if (!connectionB.counterparty) {
      throw new Error(`Counterparty not found for connection with ID ${connB}`);
    }
    // ensure the connection is open
    if (connectionA.state != State.STATE_OPEN) {
      throw new Error(
        `Connection A must be in state open, it has state ${connectionA.state}`
      );
    }
    if (connectionB.state != State.STATE_OPEN) {
      throw new Error(
        `Connection B must be in state open, it has state ${connectionB.state}`
      );
    }

    const [clientIdA, clientIdB] = [connectionA.clientId, connectionB.clientId];
    if (clientIdA !== connectionB.counterparty.clientId) {
      throw new Error(
        `Client ID ${connectionA.clientId} for connection with ID ${connA} does not match counterparty client ID ${connectionB.counterparty.clientId} for connection with ID ${connB}`
      );
    }
    if (clientIdB !== connectionA.counterparty.clientId) {
      throw new Error(
        `Client ID ${connectionB.clientId} for connection with ID ${connB} does not match counterparty client ID ${connectionA.counterparty.clientId} for connection with ID ${connA}`
      );
    }
    const [chainIdA, chainIdB, clientStateA, clientStateB] = await Promise.all([
      nodeA.getChainId(),
      nodeB.getChainId(),
      nodeA.query.ibc.client.stateTm(clientIdA),
      nodeB.query.ibc.client.stateTm(clientIdB),
    ]);
    if (chainIdA !== clientStateB.chainId) {
      throw new Error(
        `Chain ID ${chainIdA} for connection with ID ${connA} does not match remote chain ID ${clientStateA.chainId}`
      );
    }
    if (chainIdB !== clientStateA.chainId) {
      throw new Error(
        `Chain ID ${chainIdB} for connection with ID ${connB} does not match remote chain ID ${clientStateB.chainId}`
      );
    }

    const endA = new Endpoint(nodeA, clientIdA, connA);
    const endB = new Endpoint(nodeB, clientIdB, connB);
    const link = new Link(endA, endB);

    const [knownHeightA, knownHeightB] = [
      toIntHeight(clientStateA.latestHeight),
      toIntHeight(clientStateB.latestHeight),
    ];
    await Promise.all([
      link.assertHeadersMatchConsensusState('A', clientIdA, knownHeightA),
      link.assertHeadersMatchConsensusState('B', clientIdB, knownHeightB),
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
    height: number
  ): Promise<void> {
    const { src, dest } = this.getEnds(proofSide);

    // Check headers match consensus state (at least validators)
    const [consensusState, header] = await Promise.all([
      src.client.query.ibc.client.consensusStateTm(clientId, height),
      dest.client.header(height),
    ]);
    // ensure consensus and headers match for next validator hashes
    if (
      !arrayContentEquals(
        consensusState.nextValidatorsHash,
        header.nextValidatorsHash
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
  /* eslint @typescript-eslint/no-unused-vars: "off" */
  public static async createWithNewConnections(
    nodeA: IbcClient,
    nodeB: IbcClient
  ): Promise<Link> {
    const [clientIdA, clientIdB] = await createClients(nodeA, nodeB);

    // connectionInit on nodeA
    const { connectionId: connIdA } = await nodeA.connOpenInit(
      clientIdA,
      clientIdB
    );

    // connectionTry on nodeB
    const proof = await prepareConnectionHandshake(
      nodeA,
      nodeB,
      clientIdA,
      clientIdB,
      connIdA
    );
    const { connectionId: connIdB } = await nodeB.connOpenTry(clientIdB, proof);

    // connectionAck on nodeA
    const proofAck = await prepareConnectionHandshake(
      nodeB,
      nodeA,
      clientIdB,
      clientIdA,
      connIdB
    );
    await nodeA.connOpenAck(connIdA, proofAck);

    // connectionConfirm on dest
    const proofConfirm = await prepareConnectionHandshake(
      nodeA,
      nodeB,
      clientIdA,
      clientIdB,
      connIdA
    );
    await nodeB.connOpenConfirm(proofConfirm);

    const endA = new Endpoint(nodeA, clientIdA, connIdA);
    const endB = new Endpoint(nodeB, clientIdB, connIdB);
    return new Link(endA, endB);
  }

  // you can use this if you already have the info out of bounds
  // TODO; check the validity of that data?
  public constructor(endA: Endpoint, endB: Endpoint) {
    this.endA = endA;
    this.endB = endB;
  }

  /**
   * Writes the latest header from the sender chain to the other endpoint
   *
   * @param sender Which side we get the header/commit from
   *
   * Relayer binary should call this from a heartbeat which checks if needed and updates.
   * Just needs trusting period on both side
   */
  public async updateClient(sender: Side): Promise<void> {
    const { src, dest } = this.getEnds(sender);
    await dest.client.doUpdateClient(dest.clientID, src.client);
  }

  /* eslint @typescript-eslint/no-unused-vars: "off" */
  public async createChannel(
    sender: Side,
    srcPort: string,
    destPort: string,
    ordering: Order,
    version: string
  ): Promise<ChannelPair> {
    const { src, dest } = this.getEnds(sender);

    // init on src
    const { channelId: channelIdSrc } = await src.client.channelOpenInit(
      srcPort,
      destPort,
      ordering,
      src.connectionID,
      version
    );

    // try on dest
    const proof = await prepareChannelHandshake(
      src.client,
      dest.client,
      dest.clientID,
      srcPort,
      channelIdSrc
    );
    const { channelId: channelIdDest } = await dest.client.channelOpenTry(
      destPort,
      { portId: srcPort, channelId: channelIdSrc },
      ordering,
      src.connectionID,
      version,
      version,
      proof
    );

    // ack on src
    const proofAck = await prepareChannelHandshake(
      dest.client,
      src.client,
      src.clientID,
      destPort,
      channelIdDest
    );
    await src.client.channelOpenAck(
      srcPort,
      channelIdSrc,
      channelIdDest,
      version,
      proofAck
    );

    // confirm on dest
    const proofConfirm = await prepareChannelHandshake(
      src.client,
      dest.client,
      dest.clientID,
      srcPort,
      channelIdSrc
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

  public async getPendingPackets(
    source: Side,
    opts: QueryOpts = {}
  ): Promise<PacketWithMetadata[]> {
    const { src, dest } = this.getEnds(source);
    const allPackets = await src.querySentPackets(opts);
    if (allPackets.length === 0) {
      return [];
    }
    const { destinationPort, destinationChannel } = allPackets[0].packet;
    // // TODO: handle this when there are multiple channels,
    // // something like:
    // const received = await Promise.all(
    //   allPackets.map(({ packet }) =>
    //     dest.client.query.ibc.channel.unreceivedPackets(
    //       packet.destinationPort,
    //       packet.destinationChannel,
    //       [packet.sequence.toNumber()]
    //     )
    //   )
    // );
    const toCheck = allPackets.map(({ packet }) => packet.sequence.toNumber());
    const { sequences } = await dest.client.query.ibc.channel.unreceivedPackets(
      destinationPort,
      destinationChannel,
      toCheck
    );
    const unreceived = new Map(sequences.map((seq) => [seq.toNumber(), true]));
    return allPackets.filter(({ packet }) =>
      unreceived.get(packet.sequence.toNumber())
    );
  }

  private getEnds(src: Side): EndpointPair {
    if (src === 'A') {
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

interface EndpointPair {
  readonly src: Endpoint;
  readonly dest: Endpoint;
}

interface ChannelPair {
  readonly src: ChannelInfo;
  readonly dest: ChannelInfo;
}

async function createClients(
  nodeA: IbcClient,
  nodeB: IbcClient
): Promise<string[]> {
  // client on B pointing to A
  const args = await buildCreateClientArgs(nodeA, genesisUnbondingTime, 5000);
  const { clientId: clientIdB } = await nodeB.createTendermintClient(
    args.clientState,
    args.consensusState
  );

  // client on A pointing to B
  const args2 = await buildCreateClientArgs(nodeB, genesisUnbondingTime, 5000);
  const { clientId: clientIdA } = await nodeA.createTendermintClient(
    args2.clientState,
    args2.consensusState
  );

  return [clientIdA, clientIdB];
}
