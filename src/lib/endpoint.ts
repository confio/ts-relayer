import { SigningStargateClient } from '@cosmjs/stargate';

/**
 * Endpoint is a wrapper around SigningStargateClient as well as ClientID
 * and ConnectionID. Two Endpoints compose a Link and this should expose all the
 * methods you need to work on one half of an IBC Connection, the higher-level
 * orchestration is handled in Link.
 */
export class Endpoint {
  private readonly client: SigningStargateClient;
  private readonly clientID: string;
  private readonly connectionID: string;

  public constructor(
    client: SigningStargateClient,
    clientID: string,
    connectionID: string
  ) {
    this.client = client;
    this.clientID = clientID;
    this.connectionID = connectionID;
  }

  // this only exists to remvoe linter errors
  public removeMe(): string[] {
    const foo = [this.clientID, this.connectionID];
    return foo;
  }

  public async getChainId(): Promise<string> {
    return this.client.getChainId();
  }

  public async getLatestCommit(): Promise<Commit> {
    throw new Error('unimplemented!');
  }

  /* eslint @typescript-eslint/no-unused-vars: "off" */
  public async updateClient(_commit: Commit): Promise<void> {
    throw new Error('unimplemented!');
  }

  // TODO: expose all Channel lifecycle methods
  // TODO: expose post packet, post ack, post timeout methods

  // TODO: filter as closure, optional
  /* eslint @typescript-eslint/no-unused-vars: "off" */
  public async getPendingPackets(_filter: string): Promise<Packet[]> {
    throw new Error('unimplemented!');
  }

  // TODO: filter as closure, optional
  /* eslint @typescript-eslint/no-unused-vars: "off" */
  public async getPendingAcks(_filter: string): Promise<Ack[]> {
    throw new Error('unimplemented!');
  }
}

export interface Commit {
  // TODO
  readonly height: number;
}

export interface Packet {
  // TODO
  readonly someData: string;
}

export interface Ack {
  readonly acknowledgement: Uint8Array;
  readonly originalPacket: Packet;
}

/**** These are needed to bootstrap the endpoints */

// // options for client - eventually make these parameters
// const DefaultTrustLevel = '1/3';
// const TrustingPeriod = 2 * 7 * 24 * 60 * 60; // 2 weeks
// const UnbondingPeriod = 3 * 7 * 24 * 60 * 60; // 3 weeks
// const MaxClockDrift = 10; // 10 seconds
// const upgradePath = ['upgrade', 'upgradedIBCState'];
// const allowUpgradeAfterExpiry = false;
// const allowUpgradeAfterMisbehavior = false;

/**
 * This creates a tendermint client on this chain, referencing the commit info from the remote chain.
 * It returns the clientID for the newly created object
 * @param _client
 * @param _remoteChainID
 * @param _remoteCommit
 */
/* eslint @typescript-eslint/no-unused-vars: "off" */
export async function createClient(
  _client: SigningStargateClient,
  _remoteChainID: string,
  _remoteCommit: Commit
): Promise<string> {
  throw new Error('unimplemented!');
}

/* eslint @typescript-eslint/no-unused-vars: "off" */
export async function findClient(
  _client: SigningStargateClient,
  _remoteChainID: string
): Promise<string> {
  // TODO: actually verify the header, not just the chain-id
  throw new Error('unimplemented!');
}

/* eslint @typescript-eslint/no-unused-vars: "off" */
export async function findConnection(
  _client: SigningStargateClient,
  _clientId: string
): Promise<string> {
  // TODO: actually verify the header, not just the chain-id
  throw new Error('unimplemented!');
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
