import { CommitResponse } from '@cosmjs/tendermint-rpc';

import { IbcClient } from './ibcclient';

/**
 * Endpoint is a wrapper around SigningStargateClient as well as ClientID
 * and ConnectionID. Two Endpoints compose a Link and this should expose all the
 * methods you need to work on one half of an IBC Connection, the higher-level
 * orchestration is handled in Link.
 */
export class Endpoint {
  public readonly client: IbcClient;
  public readonly clientID: string;
  public readonly connectionID: string;

  public constructor(
    client: IbcClient,
    clientID: string,
    connectionID: string
  ) {
    this.client = client;
    this.clientID = clientID;
    this.connectionID = connectionID;
  }

  public async chainId(): Promise<string> {
    return this.client.getChainId();
  }

  public async getLatestCommit(): Promise<CommitResponse> {
    return this.client.getCommit();
  }

  /* eslint @typescript-eslint/no-unused-vars: "off" */
  public async updateClient(_commit: CommitResponse): Promise<void> {
    throw new Error('unimplemented!');
  }

  // TODO: expose all Channel lifecycle methods
  // TODO: expose post packet, post ack, post timeout methods
  // https://github.com/cosmos/cosmjs/issues/632

  /* eslint @typescript-eslint/no-unused-vars: "off" */
  public async getPendingPackets(
    _filter?: Filter,
    _minHeight?: number
  ): Promise<Packet[]> {
    this.client.query.ibc.unverified.connectionChannels(this.connectionID);

    // these all work for one (port, channel).
    // shall we make this general (via filter) or hit up each channel one after another
    // (and add a helper for (Endpoint, ChannelInfo) to do this easily)
    // this.client.queryClient.ibc.unverified.packetCommitments();
    // this.client.queryClient.ibc.unverified.packetAcknowledgements();
    // this.client.queryClient.ibc.unverified.unreceivedPackets();
    // this.client.queryClient.ibc.unverified.packetAcknowledgements();

    throw new Error('unimplemented!');
  }

  /* eslint @typescript-eslint/no-unused-vars: "off" */
  public async getPendingAcks(
    _filter?: Filter,
    _minHeight?: number
  ): Promise<Ack[]> {
    throw new Error('unimplemented!');
  }

  // TODO: subscription based packets/acks?
  // until then, poll every 5 minutes
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

/**
 * Requires a match of srcPortId and destPortId (if set)
 * if the channel ids are set, matches all of the channels in the set
 *
 * This is designed to easily produce search/subscription query strings,
 * not principally for in-memory filtering.
 *
 * TODO: how to filter on ConnectionID???
 * https://github.com/cosmos/cosmos-sdk/issues/8445
 */
export interface Filter {
  readonly srcPortId?: string;
  readonly srcChannelId?: string[];
  readonly destPortId?: string;
  readonly destChannelId?: string[];
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
  _client: IbcClient,
  _remoteChainID: string,
  _remoteCommit: Commit
): Promise<string> {
  throw new Error('unimplemented!');
}

/* eslint @typescript-eslint/no-unused-vars: "off" */
export async function findClient(
  _client: IbcClient,
  _remoteChainID: string
): Promise<string> {
  // TODO: actually verify the header, not just the chain-id
  throw new Error('unimplemented!');
}

/* eslint @typescript-eslint/no-unused-vars: "off" */
export async function findConnection(
  _client: IbcClient,
  _clientId: string
): Promise<string> {
  // TODO: actually verify the header, not just the chain-id
  throw new Error('unimplemented!');
}
