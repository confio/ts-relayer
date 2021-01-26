import { SigningStargateClient } from '@cosmjs/stargate';

import { Endpoint, findClient, findConnection } from './endpoint';

/**
 * Many actions on link focus on a src and a dest. Rather than add two functions,
 * we have `Side` to select if we initialize from A or B.
 */
export type Side = 'A' | 'B';

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
  public static async findConnection(
    nodeA: SigningStargateClient,
    nodeB: SigningStargateClient
  ): Promise<Link> {
    const clientA = await findClient(nodeA, await nodeB.getChainId());
    const clientB = await findClient(nodeB, await nodeA.getChainId());

    const connA = await findConnection(nodeA, clientA);
    const connB = await findConnection(nodeB, clientB);

    const endA = new Endpoint(nodeA, clientA, connA);
    const endB = new Endpoint(nodeB, clientB, connB);

    return new Link(endA, endB);
  }

  /**
   * createConnection will always create a new pair of clients and a Connection between the
   * two sides
   *
   * @param nodeA
   * @param nodeB
   */
  /* eslint @typescript-eslint/no-unused-vars: "off" */
  public static async createConnection(
    _nodeA: SigningStargateClient,
    _nodeB: SigningStargateClient
  ): Promise<Link> {
    throw new Error('unimplemented');
  }

  /*
// CreateConnection constructs and executes connection handshake messages in order to create
// OPEN channels on chainA and chainB. The connection information of for chainA and chainB
// are returned within a TestConnection struct. The function expects the connections to be
// successfully opened otherwise testing will fail.
func (coord *Coordinator) CreateConnection(
	chainA, chainB *TestChain,
	clientA, clientB string,
) (*ibctesting.TestConnection, *ibctesting.TestConnection) {

	connA, connB, err := coord.ConnOpenInit(chainA, chainB, clientA, clientB)
	require.NoError(coord.t, err)

	err = coord.ConnOpenTry(chainB, chainA, connB, connA)
	require.NoError(coord.t, err)

	err = coord.ConnOpenAck(chainA, chainB, connA, connB)
	require.NoError(coord.t, err)

	err = coord.ConnOpenConfirm(chainB, chainA, connB, connA)
	require.NoError(coord.t, err)

	return connA, connB
}
*/

  /**
   * findOrCreateConnection will try to reuse an existing Connection, but create a new one
   * if not present.
   *
   * @param nodeA
   * @param nodeB
   */
  public static async findOrCreateConnection(
    nodeA: SigningStargateClient,
    nodeB: SigningStargateClient
  ): Promise<Link> {
    try {
      const existing = await Link.findConnection(nodeA, nodeB);
      return existing;
    } catch {
      return Link.createConnection(nodeA, nodeB);
    }
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
   */
  public async updateClient(sender: Side): Promise<void> {
    const { src, dest } = this.getEnds(sender);

    const commit = await src.getLatestCommit();
    dest.updateClient(commit);
  }

  // TODO: define ordering type
  /* eslint @typescript-eslint/no-unused-vars: "off" */
  public async createChannel(
    _sender: Side,
    _srcPort: string,
    _destPort: string,
    _order: string
  ): Promise<ChannelPair> {
    throw new Error('unimplemented');
  }

  // TODO: relayAllPendingPackets (filter)
  // TODO: relayAllPendingAcks (filter)
  // TODO: relayAllRoundTrip (filter)
  // TODO: relayRoundTrip (packet)

  //   // CreateChannel constructs and executes channel handshake messages in order to create
  // // OPEN channels on chainA and chainB. The function expects the channels to be successfully
  // // opened otherwise testing will fail.
  // func (coord *Coordinator) CreateChannel(
  // 	chainA, chainB *TestChain,
  // 	connA, connB *ibctesting.TestConnection,
  // 	sourcePortID, counterpartyPortID string,
  // 	order channeltypes.Order,
  // ) (ibctesting.TestChannel, ibctesting.TestChannel) {

  // 	channelA, channelB, err := coord.ChanOpenInit(chainA, chainB, connA, connB, sourcePortID, counterpartyPortID, order)
  // 	require.NoError(coord.t, err)

  // 	err = coord.ChanOpenTry(chainB, chainA, channelB, channelA, connB, order)
  // 	require.NoError(coord.t, err)

  // 	err = coord.ChanOpenAck(chainA, chainB, channelA, channelB)
  // 	require.NoError(coord.t, err)

  // 	err = coord.ChanOpenConfirm(chainB, chainA, channelB, channelA)
  // 	require.NoError(coord.t, err)

  // 	return channelA, channelB
  // }

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

interface ChannelInfo {
  readonly portId: string;
  readonly channelId: string;
}

interface ChannelPair {
  readonly src: ChannelInfo;
  readonly dest: ChannelInfo;
}
