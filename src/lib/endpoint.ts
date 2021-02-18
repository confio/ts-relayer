import { CommitResponse } from '@cosmjs/tendermint-rpc';

import { Packet } from '../codec/ibc/core/channel/v1/channel';

import { IbcClient } from './ibcclient';
import { Ack } from './utils';

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

  // TODO: expose all Channel lifecycle methods
  // TODO: expose post packet, post ack, post timeout methods
  // https://github.com/cosmos/cosmjs/issues/632

  /* eslint @typescript-eslint/no-unused-vars: "off" */
  public async getPendingPackets(
    _filter?: Filter,
    _minHeight?: number
  ): Promise<Packet[]> {
    this.client.query.ibc.channel.connectionChannels(this.connectionID);

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
  // until then, poll every X seconds
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
