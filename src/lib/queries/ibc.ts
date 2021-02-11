import { toAscii } from '@cosmjs/encoding';
import { createPagination, createRpc, QueryClient } from '@cosmjs/stargate';
import Long from 'long';

import { Any } from '../../codec/google/protobuf/any';
import { Channel } from '../../codec/ibc/core/channel/v1/channel';
import {
  QueryClientImpl as ChannelQuery,
  QueryChannelResponse,
  QueryChannelsResponse,
  QueryConnectionChannelsResponse,
  QueryNextSequenceReceiveResponse,
  QueryPacketAcknowledgementResponse,
  QueryPacketAcknowledgementsResponse,
  QueryPacketCommitmentResponse,
  QueryPacketCommitmentsResponse,
  QueryUnreceivedAcksResponse,
  QueryUnreceivedPacketsResponse,
} from '../../codec/ibc/core/channel/v1/query';
import { Height } from '../../codec/ibc/core/client/v1/client';
import {
  QueryClientImpl as ClientQuery,
  QueryClientStateResponse,
  QueryClientStatesResponse,
} from '../../codec/ibc/core/client/v1/query';
import {
  QueryClientImpl as ConnectionQuery,
  QueryClientConnectionsResponse,
  QueryConnectionResponse,
  QueryConnectionsResponse,
} from '../../codec/ibc/core/connection/v1/query';
import { ClientState as TendermintClientState } from '../../codec/ibc/lightclients/tendermint/v1/tendermint';
import { ProofOps } from '../../codec/tendermint/crypto/proof';

export interface IbcExtension {
  readonly ibc: {
    readonly channel: {
      readonly channel: (
        portId: string,
        channelId: string
      ) => Promise<QueryChannelResponse>;
      readonly channels: (
        paginationKey?: Uint8Array
      ) => Promise<QueryChannelsResponse>;
      readonly connectionChannels: (
        connection: string,
        paginationKey?: Uint8Array
      ) => Promise<QueryConnectionChannelsResponse>;
      readonly packetCommitment: (
        portId: string,
        channelId: string,
        sequence: number
      ) => Promise<QueryPacketCommitmentResponse>;
      readonly packetCommitments: (
        portId: string,
        channelId: string,
        paginationKey?: Uint8Array
      ) => Promise<QueryPacketCommitmentsResponse>;
      readonly packetAcknowledgement: (
        portId: string,
        channelId: string,
        sequence: number
      ) => Promise<QueryPacketAcknowledgementResponse>;
      readonly packetAcknowledgements: (
        portId: string,
        channelId: string,
        paginationKey?: Uint8Array
      ) => Promise<QueryPacketAcknowledgementsResponse>;
      readonly unreceivedPackets: (
        portId: string,
        channelId: string,
        packetCommitmentSequences: readonly number[]
      ) => Promise<QueryUnreceivedPacketsResponse>;
      readonly unreceivedAcks: (
        portId: string,
        channelId: string,
        packetCommitmentSequences: readonly number[]
      ) => Promise<QueryUnreceivedAcksResponse>;
      readonly nextSequenceReceive: (
        portId: string,
        channelId: string
      ) => Promise<QueryNextSequenceReceiveResponse>;
    };
    readonly client: {
      readonly states: () => Promise<QueryClientStatesResponse>;
      readonly state: (clientId: string) => Promise<QueryClientStateResponse>;
      readonly stateTm: (clientId: string) => Promise<TendermintClientState>;
    };
    readonly connection: {
      readonly connection: (
        connectionId: string
      ) => Promise<QueryConnectionResponse>;
      readonly connections: (
        paginationKey?: Uint8Array
      ) => Promise<QueryConnectionsResponse>;
      readonly clientConnections: (
        clientId: string
      ) => Promise<QueryClientConnectionsResponse>;
    };
    readonly proof: {
      readonly channel: {
        readonly channel: (
          portId: string,
          channelId: string
        ) => Promise<QueryChannelResponse>;
        readonly packetCommitment: (
          portId: string,
          channelId: string,
          sequence: number
        ) => Promise<QueryPacketCommitmentResponse>;
        readonly packetAcknowledgement: (
          portId: string,
          channelId: string,
          sequence: number
        ) => Promise<QueryPacketAcknowledgementResponse>;
        readonly nextSequenceReceive: (
          portId: string,
          channelId: string
        ) => Promise<QueryNextSequenceReceiveResponse>;
      };
      readonly client: {
        readonly state: (clientId: string) => Promise<QueryClientStateResponse>;
      };
    };
  };
}

export function setupIbcExtension(base: QueryClient): IbcExtension {
  const rpc = createRpc(base);
  // Use these services to get easy typed access to query methods
  // These cannot be used for proof verification
  const channelQueryService = new ChannelQuery(rpc);
  const clientQueryService = new ClientQuery(rpc);
  const connectionQueryService = new ConnectionQuery(rpc);

  return {
    ibc: {
      channel: {
        channel: async (portId: string, channelId: string) => {
          const response = await channelQueryService.Channel({
            portId: portId,
            channelId: channelId,
          });
          return response;
        },
        channels: async (paginationKey?: Uint8Array) => {
          const request = {
            pagination: createPagination(paginationKey),
          };
          const response = await channelQueryService.Channels(request);
          return response;
        },
        connectionChannels: async (
          connection: string,
          paginationKey?: Uint8Array
        ) => {
          const request = {
            connection: connection,
            pagination: createPagination(paginationKey),
          };
          const response = await channelQueryService.ConnectionChannels(
            request
          );
          return response;
        },
        packetCommitment: async (
          portId: string,
          channelId: string,
          sequence: number
        ) => {
          const response = await channelQueryService.PacketCommitment({
            portId: portId,
            channelId: channelId,
            sequence: Long.fromNumber(sequence, true),
          });
          return response;
        },
        packetCommitments: async (
          portId: string,
          channelId: string,
          paginationKey?: Uint8Array
        ) => {
          const request = {
            channelId: channelId,
            portId: portId,
            pagination: createPagination(paginationKey),
          };
          const response = await channelQueryService.PacketCommitments(request);
          return response;
        },
        packetAcknowledgement: async (
          portId: string,
          channelId: string,
          sequence: number
        ) => {
          const response = await channelQueryService.PacketAcknowledgement({
            portId: portId,
            channelId: channelId,
            sequence: Long.fromNumber(sequence, true),
          });
          return response;
        },
        packetAcknowledgements: async (
          portId: string,
          channelId: string,
          paginationKey?: Uint8Array
        ) => {
          const response = await channelQueryService.PacketAcknowledgements({
            portId: portId,
            channelId: channelId,
            pagination: createPagination(paginationKey),
          });
          return response;
        },
        unreceivedPackets: async (
          portId: string,
          channelId: string,
          packetCommitmentSequences: readonly number[]
        ) => {
          const response = await channelQueryService.UnreceivedPackets({
            portId: portId,
            channelId: channelId,
            packetCommitmentSequences: packetCommitmentSequences.map((s) =>
              Long.fromNumber(s, true)
            ),
          });
          return response;
        },
        unreceivedAcks: async (
          portId: string,
          channelId: string,
          packetAckSequences: readonly number[]
        ) => {
          const response = await channelQueryService.UnreceivedAcks({
            portId: portId,
            channelId: channelId,
            packetAckSequences: packetAckSequences.map((s) =>
              Long.fromNumber(s, true)
            ),
          });
          return response;
        },
        nextSequenceReceive: async (portId: string, channelId: string) => {
          const response = await channelQueryService.NextSequenceReceive({
            portId: portId,
            channelId: channelId,
          });
          return response;
        },
      },
      client: {
        states: () => {
          return clientQueryService.ClientStates({});
        },
        // TODO: how to pass in a query height over rpc?
        state: (clientId: string) => {
          return clientQueryService.ClientState({ clientId });
        },
        stateTm: async (clientId: string) => {
          const res = await clientQueryService.ClientState({ clientId });
          if (
            res.clientState?.typeUrl !==
            '/ibc.lightclients.tendermint.v1.ClientState'
          ) {
            throw new Error(
              `Unexpected client state type: ${res.clientState?.typeUrl}`
            );
          }
          return TendermintClientState.decode(res.clientState.value);
        },
      },
      connection: {
        connection: async (connectionId: string) => {
          const response = await connectionQueryService.Connection({
            connectionId: connectionId,
          });
          return response;
        },
        connections: async (paginationKey?: Uint8Array) => {
          const request = {
            pagination: createPagination(paginationKey),
          };
          const response = await connectionQueryService.Connections(request);
          return response;
        },
        clientConnections: async (clientId: string) => {
          const response = await connectionQueryService.ClientConnections({
            clientId: clientId,
          });
          return response;
        },
      },
      proof: {
        channel: {
          channel: async (portId: string, channelId: string) => {
            // key: https://github.com/cosmos/cosmos-sdk/blob/ef0a7344af345882729598bc2958a21143930a6b/x/ibc/24-host/keys.go#L117-L120
            const key = toAscii(
              `channelEnds/ports/${portId}/channels/${channelId}`
            );
            const proven = await base.queryRawProof('ibc', key);
            const channel = Channel.decode(proven.value);
            const proof = ProofOps.encode(proven.proof).finish();
            const proofHeight = Height.fromPartial({
              revisionHeight: new Long(proven.height),
            });
            return {
              channel: channel,
              proof: proof,
              proofHeight: proofHeight,
            };
          },
          packetCommitment: async (
            portId: string,
            channelId: string,
            sequence: number
          ) => {
            // key: https://github.com/cosmos/cosmos-sdk/blob/ef0a7344af345882729598bc2958a21143930a6b/x/ibc/24-host/keys.go#L183-L185
            const key = toAscii(
              `commitments/ports/${portId}/channels/${channelId}/packets/${sequence}`
            );
            const proven = await base.queryRawProof('ibc', key);
            const commitment = proven.value;
            const proof = ProofOps.encode(proven.proof).finish();
            const proofHeight = Height.fromPartial({
              revisionHeight: new Long(proven.height),
            });
            return {
              commitment: commitment,
              proof: proof,
              proofHeight: proofHeight,
            };
          },
          packetAcknowledgement: async (
            portId: string,
            channelId: string,
            sequence: number
          ) => {
            // keeper: https://github.com/cosmos/cosmos-sdk/blob/3bafd8255a502e5a9cee07391cf8261538245dfd/x/ibc/04-channel/keeper/keeper.go#L159-L166
            // key: https://github.com/cosmos/cosmos-sdk/blob/ef0a7344af345882729598bc2958a21143930a6b/x/ibc/24-host/keys.go#L153-L156
            const key = toAscii(
              `acks/ports/${portId}/channels/${channelId}/acknowledgements/${sequence}`
            );
            const proven = await base.queryRawProof('ibc', key);
            const acknowledgement = proven.value;
            const proof = ProofOps.encode(proven.proof).finish();
            const proofHeight = Height.fromPartial({
              revisionHeight: new Long(proven.height),
            });
            return {
              acknowledgement: acknowledgement,
              proof: proof,
              proofHeight: proofHeight,
            };
          },
          nextSequenceReceive: async (portId: string, channelId: string) => {
            // keeper: https://github.com/cosmos/cosmos-sdk/blob/3bafd8255a502e5a9cee07391cf8261538245dfd/x/ibc/04-channel/keeper/keeper.go#L92-L101
            // key: https://github.com/cosmos/cosmos-sdk/blob/ef0a7344af345882729598bc2958a21143930a6b/x/ibc/24-host/keys.go#L133-L136
            const key = toAscii(
              `seqAcks/ports/${portId}/channels/${channelId}/nextSequenceAck`
            );
            const proven = await base.queryRawProof('ibc', key);
            const nextSequenceReceive = Long.fromBytesBE([...proven.value]);
            const proof = ProofOps.encode(proven.proof).finish();
            const proofHeight = Height.fromPartial({
              revisionHeight: new Long(proven.height),
            });
            return {
              nextSequenceReceive: nextSequenceReceive,
              proof: proof,
              proofHeight: proofHeight,
            };
          },
        },
        client: {
          state: async (clientId: string) => {
            const key = `clients/${clientId}/clientState`;
            const proven = await base.queryRawProof('ibc', toAscii(key));
            const clientState = Any.decode(proven.value);
            const proof = ProofOps.encode(proven.proof).finish();
            const proofHeight = Height.fromPartial({
              revisionHeight: new Long(proven.height),
            });
            return {
              clientState,
              proof,
              proofHeight,
            };
          },
        },
      },
    },
  };
}
