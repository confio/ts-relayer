import { toAscii } from "@cosmjs/encoding";
import { Uint64 } from "@cosmjs/math";
import {
  createPagination,
  createProtobufRpcClient,
  QueryClient,
} from "@cosmjs/stargate";
import { CommitmentProof } from "cosmjs-types/cosmos/ics23/v1/proofs";
import { Any } from "cosmjs-types/google/protobuf/any";
import { Channel } from "cosmjs-types/ibc/core/channel/v1/channel";
import {
  QueryClientImpl as ChannelQuery,
  QueryChannelClientStateResponse,
  QueryChannelConsensusStateResponse,
  QueryChannelResponse,
  QueryChannelsResponse,
  QueryConnectionChannelsResponse,
  QueryNextSequenceReceiveResponse,
  QueryPacketAcknowledgementResponse,
  QueryPacketAcknowledgementsRequest,
  QueryPacketAcknowledgementsResponse,
  QueryPacketCommitmentResponse,
  QueryPacketCommitmentsResponse,
  QueryPacketReceiptResponse,
  QueryUnreceivedAcksResponse,
  QueryUnreceivedPacketsResponse,
} from "cosmjs-types/ibc/core/channel/v1/query";
import { Height } from "cosmjs-types/ibc/core/client/v1/client";
import {
  QueryClientImpl as ClientQuery,
  QueryClientParamsResponse,
  QueryClientStateResponse,
  QueryClientStatesResponse,
  QueryConsensusStateRequest,
  QueryConsensusStateResponse,
  QueryConsensusStatesResponse,
} from "cosmjs-types/ibc/core/client/v1/query";
import { MerkleProof } from "cosmjs-types/ibc/core/commitment/v1/commitment";
import { ConnectionEnd } from "cosmjs-types/ibc/core/connection/v1/connection";
import {
  QueryClientImpl as ConnectionQuery,
  QueryClientConnectionsResponse,
  QueryConnectionClientStateResponse,
  QueryConnectionConsensusStateRequest,
  QueryConnectionConsensusStateResponse,
  QueryConnectionResponse,
  QueryConnectionsResponse,
} from "cosmjs-types/ibc/core/connection/v1/query";
import {
  ClientState as TendermintClientState,
  ConsensusState as TendermintConsensusState,
} from "cosmjs-types/ibc/lightclients/tendermint/v1/tendermint";
import { ProofOps } from "cosmjs-types/tendermint/crypto/proof";

function decodeTendermintClientStateAny(
  clientState: Any | undefined,
): TendermintClientState {
  if (clientState?.typeUrl !== "/ibc.lightclients.tendermint.v1.ClientState") {
    throw new Error(`Unexpected client state type: ${clientState?.typeUrl}`);
  }
  return TendermintClientState.decode(clientState.value);
}

function decodeTendermintConsensusStateAny(
  clientState: Any | undefined,
): TendermintConsensusState {
  if (
    clientState?.typeUrl !== "/ibc.lightclients.tendermint.v1.ConsensusState"
  ) {
    throw new Error(`Unexpected client state type: ${clientState?.typeUrl}`);
  }
  return TendermintConsensusState.decode(clientState.value);
}

export function heightQueryString(height: Height): string {
  return `${height.revisionNumber}-${height.revisionHeight}`;
}

export interface IbcExtension {
  readonly ibc: {
    readonly channel: {
      readonly channel: (
        portId: string,
        channelId: string,
      ) => Promise<QueryChannelResponse>;
      readonly channels: (
        paginationKey?: Uint8Array,
      ) => Promise<QueryChannelsResponse>;
      readonly allChannels: () => Promise<QueryChannelsResponse>;
      readonly connectionChannels: (
        connection: string,
        paginationKey?: Uint8Array,
      ) => Promise<QueryConnectionChannelsResponse>;
      readonly allConnectionChannels: (
        connection: string,
      ) => Promise<QueryConnectionChannelsResponse>;
      readonly clientState: (
        portId: string,
        channelId: string,
      ) => Promise<QueryChannelClientStateResponse>;
      readonly consensusState: (
        portId: string,
        channelId: string,
        revisionNumber: number,
        revisionHeight: number,
      ) => Promise<QueryChannelConsensusStateResponse>;
      readonly packetCommitment: (
        portId: string,
        channelId: string,
        sequence: bigint,
      ) => Promise<QueryPacketCommitmentResponse>;
      readonly packetCommitments: (
        portId: string,
        channelId: string,
        paginationKey?: Uint8Array,
      ) => Promise<QueryPacketCommitmentsResponse>;
      readonly allPacketCommitments: (
        portId: string,
        channelId: string,
      ) => Promise<QueryPacketCommitmentsResponse>;
      readonly packetReceipt: (
        portId: string,
        channelId: string,
        sequence: number,
      ) => Promise<QueryPacketReceiptResponse>;
      readonly packetAcknowledgement: (
        portId: string,
        channelId: string,
        sequence: number,
      ) => Promise<QueryPacketAcknowledgementResponse>;
      readonly packetAcknowledgements: (
        portId: string,
        channelId: string,
        paginationKey?: Uint8Array,
      ) => Promise<QueryPacketAcknowledgementsResponse>;
      readonly allPacketAcknowledgements: (
        portId: string,
        channelId: string,
      ) => Promise<QueryPacketAcknowledgementsResponse>;
      readonly unreceivedPackets: (
        portId: string,
        channelId: string,
        packetCommitmentSequences: readonly number[],
      ) => Promise<QueryUnreceivedPacketsResponse>;
      readonly unreceivedAcks: (
        portId: string,
        channelId: string,
        packetAckSequences: readonly number[],
      ) => Promise<QueryUnreceivedAcksResponse>;
      readonly nextSequenceReceive: (
        portId: string,
        channelId: string,
      ) => Promise<QueryNextSequenceReceiveResponse>;
    };
    readonly client: {
      readonly state: (clientId: string) => Promise<QueryClientStateResponse>;
      readonly states: (
        paginationKey?: Uint8Array,
      ) => Promise<QueryClientStatesResponse>;
      readonly allStates: () => Promise<QueryClientStatesResponse>;
      readonly consensusState: (
        clientId: string,
        height?: number,
      ) => Promise<QueryConsensusStateResponse>;
      readonly consensusStates: (
        clientId: string,
        paginationKey?: Uint8Array,
      ) => Promise<QueryConsensusStatesResponse>;
      readonly allConsensusStates: (
        clientId: string,
      ) => Promise<QueryConsensusStatesResponse>;
      readonly params: () => Promise<QueryClientParamsResponse>;
      readonly stateTm: (clientId: string) => Promise<TendermintClientState>;
      readonly statesTm: (
        paginationKey?: Uint8Array,
      ) => Promise<TendermintClientState[]>;
      readonly allStatesTm: () => Promise<TendermintClientState[]>;
      readonly consensusStateTm: (
        clientId: string,
        height?: Height,
      ) => Promise<TendermintConsensusState>;
    };
    readonly connection: {
      readonly connection: (
        connectionId: string,
      ) => Promise<QueryConnectionResponse>;
      readonly connections: (
        paginationKey?: Uint8Array,
      ) => Promise<QueryConnectionsResponse>;
      readonly allConnections: () => Promise<QueryConnectionsResponse>;
      readonly clientConnections: (
        clientId: string,
      ) => Promise<QueryClientConnectionsResponse>;
      readonly clientState: (
        connectionId: string,
      ) => Promise<QueryConnectionClientStateResponse>;
      readonly consensusState: (
        connectionId: string,
        revisionNumber: number,
        revisionHeight: number,
      ) => Promise<QueryConnectionConsensusStateResponse>;
    };
    readonly proof: {
      readonly channel: {
        readonly channel: (
          portId: string,
          channelId: string,
          proofHeight: Height,
        ) => Promise<QueryChannelResponse>;
        readonly receiptProof: (
          portId: string,
          channelId: string,
          sequence: number,
          proofHeight: Height,
        ) => Promise<Uint8Array>;
        readonly packetCommitment: (
          portId: string,
          channelId: string,
          sequence: bigint,
          proofHeight: Height,
        ) => Promise<QueryPacketCommitmentResponse>;
        readonly packetAcknowledgement: (
          portId: string,
          channelId: string,
          sequence: number,
          proofHeight: Height,
        ) => Promise<QueryPacketAcknowledgementResponse>;
        readonly nextSequenceReceive: (
          portId: string,
          channelId: string,
          proofHeight: Height,
        ) => Promise<QueryNextSequenceReceiveResponse>;
      };
      readonly client: {
        readonly state: (
          clientId: string,
          proofHeight: Height,
        ) => Promise<QueryClientStateResponse & { proofHeight: Height }>;
        readonly consensusState: (
          clientId: string,
          consensusHeight: Height,
          proofHeight: Height,
        ) => Promise<QueryConsensusStateResponse>;
      };
      readonly connection: {
        readonly connection: (
          connectionId: string,
          proofHeight: Height,
        ) => Promise<QueryConnectionResponse>;
      };
    };
  };
}

export function setupIbcExtension(base: QueryClient): IbcExtension {
  const rpc = createProtobufRpcClient(base);
  // Use these services to get easy typed access to query methods
  // These cannot be used for proof verification
  const channelQueryService = new ChannelQuery(rpc);
  const clientQueryService = new ClientQuery(rpc);
  const connectionQueryService = new ConnectionQuery(rpc);

  return {
    ibc: {
      channel: {
        channel: async (portId: string, channelId: string) =>
          channelQueryService.Channel({
            portId,
            channelId,
          }),
        channels: async (paginationKey?: Uint8Array) =>
          channelQueryService.Channels({
            pagination: createPagination(paginationKey),
          }),
        allChannels: async () => {
          const channels = [];
          let response: QueryChannelsResponse;
          let key: Uint8Array | undefined;
          do {
            response = await channelQueryService.Channels({
              pagination: createPagination(key),
            });
            channels.push(...response.channels);
            key = response.pagination?.nextKey;
          } while (key && key.length);
          return {
            channels,
            height: response.height,
          };
        },
        connectionChannels: async (
          connection: string,
          paginationKey?: Uint8Array,
        ) =>
          channelQueryService.ConnectionChannels({
            connection,
            pagination: createPagination(paginationKey),
          }),
        allConnectionChannels: async (connection: string) => {
          const channels = [];
          let response: QueryConnectionChannelsResponse;
          let key: Uint8Array | undefined;
          do {
            response = await channelQueryService.ConnectionChannels({
              connection,
              pagination: createPagination(key),
            });
            channels.push(...response.channels);
            key = response.pagination?.nextKey;
          } while (key && key.length);
          return {
            channels,
            height: response.height,
          };
        },
        clientState: async (portId: string, channelId: string) =>
          channelQueryService.ChannelClientState({
            portId,
            channelId,
          }),
        consensusState: async (
          portId: string,
          channelId: string,
          revisionNumber: number,
          revisionHeight: number,
        ) =>
          channelQueryService.ChannelConsensusState({
            portId,
            channelId,
            revisionNumber: BigInt(revisionNumber),
            revisionHeight: BigInt(revisionHeight),
          }),
        packetCommitment: async (
          portId: string,
          channelId: string,
          sequence: bigint,
        ) =>
          channelQueryService.PacketCommitment({
            portId,
            channelId,
            sequence,
          }),
        packetCommitments: async (
          portId: string,
          channelId: string,
          paginationKey?: Uint8Array,
        ) =>
          channelQueryService.PacketCommitments({
            channelId,
            portId,
            pagination: createPagination(paginationKey),
          }),
        allPacketCommitments: async (portId: string, channelId: string) => {
          const commitments = [];
          let response: QueryPacketCommitmentsResponse;
          let key: Uint8Array | undefined;
          do {
            response = await channelQueryService.PacketCommitments({
              channelId,
              portId,
              pagination: createPagination(key),
            });
            commitments.push(...response.commitments);
            key = response.pagination?.nextKey;
          } while (key && key.length);
          return {
            commitments,
            height: response.height,
          };
        },
        packetReceipt: async (
          portId: string,
          channelId: string,
          sequence: number,
        ) =>
          channelQueryService.PacketReceipt({
            portId,
            channelId,
            sequence: BigInt(sequence),
          }),
        packetAcknowledgement: async (
          portId: string,
          channelId: string,
          sequence: number,
        ) =>
          channelQueryService.PacketAcknowledgement({
            portId,
            channelId,
            sequence: BigInt(sequence),
          }),
        packetAcknowledgements: async (
          portId: string,
          channelId: string,
          paginationKey?: Uint8Array,
        ) => {
          const request = QueryPacketAcknowledgementsRequest.fromPartial({
            portId,
            channelId,
            pagination: createPagination(paginationKey),
          });
          return channelQueryService.PacketAcknowledgements(request);
        },
        allPacketAcknowledgements: async (
          portId: string,
          channelId: string,
        ) => {
          const acknowledgements = [];
          let response: QueryPacketAcknowledgementsResponse;
          let key: Uint8Array | undefined;
          do {
            const request = QueryPacketAcknowledgementsRequest.fromPartial({
              channelId,
              portId,
              pagination: createPagination(key),
            });
            response =
              await channelQueryService.PacketAcknowledgements(request);
            acknowledgements.push(...response.acknowledgements);
            key = response.pagination?.nextKey;
          } while (key && key.length);
          return {
            acknowledgements,
            height: response.height,
          };
        },
        unreceivedPackets: async (
          portId: string,
          channelId: string,
          packetCommitmentSequences: readonly number[],
        ) =>
          channelQueryService.UnreceivedPackets({
            portId,
            channelId,
            packetCommitmentSequences: packetCommitmentSequences.map((s) =>
              BigInt(s),
            ),
          }),
        unreceivedAcks: async (
          portId: string,
          channelId: string,
          packetAckSequences: readonly number[],
        ) =>
          channelQueryService.UnreceivedAcks({
            portId,
            channelId,
            packetAckSequences: packetAckSequences.map((s) => BigInt(s)),
          }),
        nextSequenceReceive: async (portId: string, channelId: string) =>
          channelQueryService.NextSequenceReceive({
            portId,
            channelId,
          }),
      },
      client: {
        state: (clientId: string) =>
          clientQueryService.ClientState({ clientId }),
        states: (paginationKey?: Uint8Array) =>
          clientQueryService.ClientStates({
            pagination: createPagination(paginationKey),
          }),
        allStates: async () => {
          const clientStates = [];
          let response: QueryClientStatesResponse;
          let key: Uint8Array | undefined;
          do {
            response = await clientQueryService.ClientStates({
              pagination: createPagination(key),
            });
            clientStates.push(...response.clientStates);
            key = response.pagination?.nextKey;
          } while (key && key.length);
          return {
            clientStates,
          };
        },
        consensusState: (clientId: string, consensusHeight?: number) =>
          clientQueryService.ConsensusState(
            QueryConsensusStateRequest.fromPartial({
              clientId,
              revisionHeight:
                consensusHeight !== undefined
                  ? BigInt(consensusHeight)
                  : undefined,
              latestHeight: consensusHeight === undefined,
            }),
          ),
        consensusStates: (clientId: string, paginationKey?: Uint8Array) =>
          clientQueryService.ConsensusStates({
            clientId,
            pagination: createPagination(paginationKey),
          }),
        allConsensusStates: async (clientId: string) => {
          const consensusStates = [];
          let response: QueryConsensusStatesResponse;
          let key: Uint8Array | undefined;
          do {
            response = await clientQueryService.ConsensusStates({
              clientId,
              pagination: createPagination(key),
            });
            consensusStates.push(...response.consensusStates);
            key = response.pagination?.nextKey;
          } while (key && key.length);
          return {
            consensusStates,
          };
        },
        params: () => clientQueryService.ClientParams({}),
        stateTm: async (clientId: string) => {
          const response = await clientQueryService.ClientState({ clientId });
          return decodeTendermintClientStateAny(response.clientState);
        },
        statesTm: async (paginationKey?: Uint8Array) => {
          const { clientStates } = await clientQueryService.ClientStates({
            pagination: createPagination(paginationKey),
          });
          return clientStates.map(({ clientState }) =>
            decodeTendermintClientStateAny(clientState),
          );
        },
        allStatesTm: async () => {
          const clientStates = [];
          let response: QueryClientStatesResponse;
          let key: Uint8Array | undefined;
          do {
            response = await clientQueryService.ClientStates({
              pagination: createPagination(key),
            });
            clientStates.push(...response.clientStates);
            key = response.pagination?.nextKey;
          } while (key && key.length);
          return clientStates.map(({ clientState }) =>
            decodeTendermintClientStateAny(clientState),
          );
        },
        consensusStateTm: async (
          clientId: string,
          consensusHeight?: Height,
        ) => {
          const response = await clientQueryService.ConsensusState(
            QueryConsensusStateRequest.fromPartial({
              clientId,
              revisionHeight: consensusHeight?.revisionHeight,
              revisionNumber: consensusHeight?.revisionNumber,
              latestHeight: consensusHeight === undefined,
            }),
          );
          return decodeTendermintConsensusStateAny(response.consensusState);
        },
      },
      connection: {
        connection: async (connectionId: string) =>
          connectionQueryService.Connection({
            connectionId,
          }),
        connections: async (paginationKey?: Uint8Array) =>
          connectionQueryService.Connections({
            pagination: createPagination(paginationKey),
          }),
        allConnections: async () => {
          const connections = [];
          let response: QueryConnectionsResponse;
          let key: Uint8Array | undefined;
          do {
            response = await connectionQueryService.Connections({
              pagination: createPagination(key),
            });
            connections.push(...response.connections);
            key = response.pagination?.nextKey;
          } while (key && key.length);
          return {
            connections,
            height: response.height,
          };
        },
        clientConnections: async (clientId: string) =>
          connectionQueryService.ClientConnections({
            clientId,
          }),
        clientState: async (connectionId: string) =>
          connectionQueryService.ConnectionClientState({
            connectionId,
          }),
        consensusState: async (connectionId: string, revisionHeight: number) =>
          connectionQueryService.ConnectionConsensusState(
            QueryConnectionConsensusStateRequest.fromPartial({
              connectionId,
              revisionHeight: BigInt(revisionHeight),
            }),
          ),
      },
      proof: {
        // these keys can all be found here: https://github.com/cosmos/cosmos-sdk/blob/v0.41.1/x/ibc/core/24-host/keys.go
        // note some have changed since the v0.40 pre-release this code was based on
        channel: {
          channel: async (
            portId: string,
            channelId: string,
            proofHeight: Height,
          ) => {
            // key: https://github.com/cosmos/cosmos-sdk/blob/ef0a7344af345882729598bc2958a21143930a6b/x/ibc/24-host/keys.go#L117-L120
            const key = toAscii(
              `channelEnds/ports/${portId}/channels/${channelId}`,
            );
            const proven = await base.queryRawProof(
              "ibc",
              key,
              Number(proofHeight.revisionHeight),
            );
            const channel = Channel.decode(proven.value);
            const proof = convertProofsToIcs23(proven.proof);
            return {
              channel,
              proof,
              proofHeight,
            };
          },
          // designed only for timeout, modify if we need actual value not just proof
          // could not verify absence of key receipts/ports/transfer/channels/channel-5/sequences/2
          receiptProof: async (
            portId: string,
            channelId: string,
            sequence: number,
            proofHeight: Height,
          ) => {
            const key = toAscii(
              `receipts/ports/${portId}/channels/${channelId}/sequences/${sequence}`,
            );
            const proven = await base.queryRawProof(
              "ibc",
              key,
              Number(proofHeight.revisionHeight),
            );
            const proof = convertProofsToIcs23(proven.proof);
            return proof;
          },
          packetCommitment: async (
            portId: string,
            channelId: string,
            sequence: bigint,
            proofHeight: Height,
          ) => {
            const key = toAscii(
              `commitments/ports/${portId}/channels/${channelId}/sequences/${sequence}`,
            );
            const proven = await base.queryRawProof(
              "ibc",
              key,
              Number(proofHeight.revisionHeight),
            );
            const commitment = proven.value;
            const proof = convertProofsToIcs23(proven.proof);
            return {
              commitment,
              proof,
              proofHeight,
            };
          },
          packetAcknowledgement: async (
            portId: string,
            channelId: string,
            sequence: number,
            proofHeight: Height,
          ) => {
            const key = toAscii(
              `acks/ports/${portId}/channels/${channelId}/sequences/${sequence}`,
            );
            const proven = await base.queryRawProof(
              "ibc",
              key,
              Number(proofHeight.revisionHeight),
            );
            const acknowledgement = proven.value;
            const proof = convertProofsToIcs23(proven.proof);
            return {
              acknowledgement,
              proof,
              proofHeight,
            };
          },
          nextSequenceReceive: async (
            portId: string,
            channelId: string,
            proofHeight: Height,
          ) => {
            const key = toAscii(
              `nextSequenceRecv/ports/${portId}/channels/${channelId}`,
            );
            const proven = await base.queryRawProof(
              "ibc",
              key,
              Number(proofHeight.revisionHeight),
            );
            const nextSequenceReceive = Uint64.fromBytes(
              [...proven.value],
              "be",
            ).toBigInt();
            const proof = convertProofsToIcs23(proven.proof);
            return {
              nextSequenceReceive,
              proof,
              proofHeight,
            };
          },
        },
        client: {
          state: async (clientId: string, proofHeight: Height) => {
            const key = `clients/${clientId}/clientState`;
            const proven = await base.queryRawProof(
              "ibc",
              toAscii(key),
              Number(proofHeight.revisionHeight),
            );
            const clientState = Any.decode(proven.value);
            const proof = convertProofsToIcs23(proven.proof);
            return {
              clientState,
              proof,
              proofHeight,
            };
          },
          consensusState: async (
            clientId: string,
            consensusHeight: Height,
            proofHeight: Height,
          ) => {
            const height = heightQueryString(consensusHeight);
            const key = `clients/${clientId}/consensusStates/${height}`;
            const proven = await base.queryRawProof(
              "ibc",
              toAscii(key),
              Number(proofHeight.revisionHeight),
            );
            const consensusState = Any.decode(proven.value);
            const proof = convertProofsToIcs23(proven.proof);
            return {
              consensusState,
              proof,
              proofHeight,
            };
          },
        },
        connection: {
          connection: async (connectionId: string, proofHeight: Height) => {
            const key = `connections/${connectionId}`;
            const proven = await base.queryRawProof(
              "ibc",
              toAscii(key),
              Number(proofHeight.revisionHeight),
            );
            const connection = ConnectionEnd.decode(proven.value);
            const proof = convertProofsToIcs23(proven.proof);
            return {
              connection,
              proof,
              proofHeight,
            };
          },
        },
      },
    },
  };
}

function convertProofsToIcs23(ops: ProofOps): Uint8Array {
  const proofs = ops.ops.map((op) => CommitmentProof.decode(op.data));
  const resp = MerkleProof.fromPartial({
    proofs,
  });
  return MerkleProof.encode(resp).finish();
}
