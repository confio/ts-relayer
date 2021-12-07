/* eslint-disable */
import Long from 'long';
import _m0 from 'protobufjs/minimal';
import { Any } from '../../../../google/protobuf/any';

export const protobufPackage = 'ibc.core.client.v1';

/**
 * IdentifiedClientState defines a client state with an additional client
 * identifier field.
 */
export interface IdentifiedClientState {
  /** client identifier */
  clientId: string;
  /** client state */
  clientState?: Any;
}

/** ConsensusStateWithHeight defines a consensus state with an additional height field. */
export interface ConsensusStateWithHeight {
  /** consensus state height */
  height?: Height;
  /** consensus state */
  consensusState?: Any;
}

/**
 * ClientConsensusStates defines all the stored consensus states for a given
 * client.
 */
export interface ClientConsensusStates {
  /** client identifier */
  clientId: string;
  /** consensus states and their heights associated with the client */
  consensusStates: ConsensusStateWithHeight[];
}

/**
 * ClientUpdateProposal is a governance proposal. If it passes, the client is
 * updated with the provided header. The update may fail if the header is not
 * valid given certain conditions specified by the client implementation.
 */
export interface ClientUpdateProposal {
  /** the title of the update proposal */
  title: string;
  /** the description of the proposal */
  description: string;
  /** the client identifier for the client to be updated if the proposal passes */
  clientId: string;
  /** the header used to update the client if the proposal passes */
  header?: Any;
}

/**
 * Height is a monotonically increasing data type
 * that can be compared against another Height for the purposes of updating and
 * freezing clients
 *
 * Normally the RevisionHeight is incremented at each height while keeping RevisionNumber
 * the same. However some consensus algorithms may choose to reset the
 * height in certain conditions e.g. hard forks, state-machine breaking changes
 * In these cases, the RevisionNumber is incremented so that height continues to
 * be monitonically increasing even as the RevisionHeight gets reset
 */
export interface Height {
  /** the revision that the client is currently on */
  revisionNumber: Long;
  /** the height within the given revision */
  revisionHeight: Long;
}

/** Params defines the set of IBC light client parameters. */
export interface Params {
  /** allowed_clients defines the list of allowed client state types. */
  allowedClients: string[];
}

const baseIdentifiedClientState: object = { clientId: '' };

export const IdentifiedClientState = {
  encode(
    message: IdentifiedClientState,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.clientId !== '') {
      writer.uint32(10).string(message.clientId);
    }
    if (message.clientState !== undefined) {
      Any.encode(message.clientState, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(
    input: _m0.Reader | Uint8Array,
    length?: number
  ): IdentifiedClientState {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseIdentifiedClientState } as IdentifiedClientState;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.clientId = reader.string();
          break;
        case 2:
          message.clientState = Any.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): IdentifiedClientState {
    const message = { ...baseIdentifiedClientState } as IdentifiedClientState;
    message.clientId =
      object.clientId !== undefined && object.clientId !== null
        ? String(object.clientId)
        : '';
    message.clientState =
      object.clientState !== undefined && object.clientState !== null
        ? Any.fromJSON(object.clientState)
        : undefined;
    return message;
  },

  toJSON(message: IdentifiedClientState): unknown {
    const obj: any = {};
    message.clientId !== undefined && (obj.clientId = message.clientId);
    message.clientState !== undefined &&
      (obj.clientState = message.clientState
        ? Any.toJSON(message.clientState)
        : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<IdentifiedClientState>, I>>(
    object: I
  ): IdentifiedClientState {
    const message = { ...baseIdentifiedClientState } as IdentifiedClientState;
    message.clientId = object.clientId ?? '';
    message.clientState =
      object.clientState !== undefined && object.clientState !== null
        ? Any.fromPartial(object.clientState)
        : undefined;
    return message;
  },
};

const baseConsensusStateWithHeight: object = {};

export const ConsensusStateWithHeight = {
  encode(
    message: ConsensusStateWithHeight,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.height !== undefined) {
      Height.encode(message.height, writer.uint32(10).fork()).ldelim();
    }
    if (message.consensusState !== undefined) {
      Any.encode(message.consensusState, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(
    input: _m0.Reader | Uint8Array,
    length?: number
  ): ConsensusStateWithHeight {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = {
      ...baseConsensusStateWithHeight,
    } as ConsensusStateWithHeight;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.height = Height.decode(reader, reader.uint32());
          break;
        case 2:
          message.consensusState = Any.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ConsensusStateWithHeight {
    const message = {
      ...baseConsensusStateWithHeight,
    } as ConsensusStateWithHeight;
    message.height =
      object.height !== undefined && object.height !== null
        ? Height.fromJSON(object.height)
        : undefined;
    message.consensusState =
      object.consensusState !== undefined && object.consensusState !== null
        ? Any.fromJSON(object.consensusState)
        : undefined;
    return message;
  },

  toJSON(message: ConsensusStateWithHeight): unknown {
    const obj: any = {};
    message.height !== undefined &&
      (obj.height = message.height ? Height.toJSON(message.height) : undefined);
    message.consensusState !== undefined &&
      (obj.consensusState = message.consensusState
        ? Any.toJSON(message.consensusState)
        : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ConsensusStateWithHeight>, I>>(
    object: I
  ): ConsensusStateWithHeight {
    const message = {
      ...baseConsensusStateWithHeight,
    } as ConsensusStateWithHeight;
    message.height =
      object.height !== undefined && object.height !== null
        ? Height.fromPartial(object.height)
        : undefined;
    message.consensusState =
      object.consensusState !== undefined && object.consensusState !== null
        ? Any.fromPartial(object.consensusState)
        : undefined;
    return message;
  },
};

const baseClientConsensusStates: object = { clientId: '' };

export const ClientConsensusStates = {
  encode(
    message: ClientConsensusStates,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.clientId !== '') {
      writer.uint32(10).string(message.clientId);
    }
    for (const v of message.consensusStates) {
      ConsensusStateWithHeight.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(
    input: _m0.Reader | Uint8Array,
    length?: number
  ): ClientConsensusStates {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseClientConsensusStates } as ClientConsensusStates;
    message.consensusStates = [];
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.clientId = reader.string();
          break;
        case 2:
          message.consensusStates.push(
            ConsensusStateWithHeight.decode(reader, reader.uint32())
          );
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ClientConsensusStates {
    const message = { ...baseClientConsensusStates } as ClientConsensusStates;
    message.clientId =
      object.clientId !== undefined && object.clientId !== null
        ? String(object.clientId)
        : '';
    message.consensusStates = (object.consensusStates ?? []).map((e: any) =>
      ConsensusStateWithHeight.fromJSON(e)
    );
    return message;
  },

  toJSON(message: ClientConsensusStates): unknown {
    const obj: any = {};
    message.clientId !== undefined && (obj.clientId = message.clientId);
    if (message.consensusStates) {
      obj.consensusStates = message.consensusStates.map((e) =>
        e ? ConsensusStateWithHeight.toJSON(e) : undefined
      );
    } else {
      obj.consensusStates = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ClientConsensusStates>, I>>(
    object: I
  ): ClientConsensusStates {
    const message = { ...baseClientConsensusStates } as ClientConsensusStates;
    message.clientId = object.clientId ?? '';
    message.consensusStates =
      object.consensusStates?.map((e) =>
        ConsensusStateWithHeight.fromPartial(e)
      ) || [];
    return message;
  },
};

const baseClientUpdateProposal: object = {
  title: '',
  description: '',
  clientId: '',
};

export const ClientUpdateProposal = {
  encode(
    message: ClientUpdateProposal,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.title !== '') {
      writer.uint32(10).string(message.title);
    }
    if (message.description !== '') {
      writer.uint32(18).string(message.description);
    }
    if (message.clientId !== '') {
      writer.uint32(26).string(message.clientId);
    }
    if (message.header !== undefined) {
      Any.encode(message.header, writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(
    input: _m0.Reader | Uint8Array,
    length?: number
  ): ClientUpdateProposal {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseClientUpdateProposal } as ClientUpdateProposal;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.title = reader.string();
          break;
        case 2:
          message.description = reader.string();
          break;
        case 3:
          message.clientId = reader.string();
          break;
        case 4:
          message.header = Any.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ClientUpdateProposal {
    const message = { ...baseClientUpdateProposal } as ClientUpdateProposal;
    message.title =
      object.title !== undefined && object.title !== null
        ? String(object.title)
        : '';
    message.description =
      object.description !== undefined && object.description !== null
        ? String(object.description)
        : '';
    message.clientId =
      object.clientId !== undefined && object.clientId !== null
        ? String(object.clientId)
        : '';
    message.header =
      object.header !== undefined && object.header !== null
        ? Any.fromJSON(object.header)
        : undefined;
    return message;
  },

  toJSON(message: ClientUpdateProposal): unknown {
    const obj: any = {};
    message.title !== undefined && (obj.title = message.title);
    message.description !== undefined &&
      (obj.description = message.description);
    message.clientId !== undefined && (obj.clientId = message.clientId);
    message.header !== undefined &&
      (obj.header = message.header ? Any.toJSON(message.header) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ClientUpdateProposal>, I>>(
    object: I
  ): ClientUpdateProposal {
    const message = { ...baseClientUpdateProposal } as ClientUpdateProposal;
    message.title = object.title ?? '';
    message.description = object.description ?? '';
    message.clientId = object.clientId ?? '';
    message.header =
      object.header !== undefined && object.header !== null
        ? Any.fromPartial(object.header)
        : undefined;
    return message;
  },
};

const baseHeight: object = {
  revisionNumber: Long.UZERO,
  revisionHeight: Long.UZERO,
};

export const Height = {
  encode(
    message: Height,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (!message.revisionNumber.isZero()) {
      writer.uint32(8).uint64(message.revisionNumber);
    }
    if (!message.revisionHeight.isZero()) {
      writer.uint32(16).uint64(message.revisionHeight);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Height {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseHeight } as Height;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.revisionNumber = reader.uint64() as Long;
          break;
        case 2:
          message.revisionHeight = reader.uint64() as Long;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Height {
    const message = { ...baseHeight } as Height;
    message.revisionNumber =
      object.revisionNumber !== undefined && object.revisionNumber !== null
        ? Long.fromString(object.revisionNumber)
        : Long.UZERO;
    message.revisionHeight =
      object.revisionHeight !== undefined && object.revisionHeight !== null
        ? Long.fromString(object.revisionHeight)
        : Long.UZERO;
    return message;
  },

  toJSON(message: Height): unknown {
    const obj: any = {};
    message.revisionNumber !== undefined &&
      (obj.revisionNumber = (message.revisionNumber || Long.UZERO).toString());
    message.revisionHeight !== undefined &&
      (obj.revisionHeight = (message.revisionHeight || Long.UZERO).toString());
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Height>, I>>(object: I): Height {
    const message = { ...baseHeight } as Height;
    message.revisionNumber =
      object.revisionNumber !== undefined && object.revisionNumber !== null
        ? Long.fromValue(object.revisionNumber)
        : Long.UZERO;
    message.revisionHeight =
      object.revisionHeight !== undefined && object.revisionHeight !== null
        ? Long.fromValue(object.revisionHeight)
        : Long.UZERO;
    return message;
  },
};

const baseParams: object = { allowedClients: '' };

export const Params = {
  encode(
    message: Params,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    for (const v of message.allowedClients) {
      writer.uint32(10).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Params {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseParams } as Params;
    message.allowedClients = [];
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.allowedClients.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Params {
    const message = { ...baseParams } as Params;
    message.allowedClients = (object.allowedClients ?? []).map((e: any) =>
      String(e)
    );
    return message;
  },

  toJSON(message: Params): unknown {
    const obj: any = {};
    if (message.allowedClients) {
      obj.allowedClients = message.allowedClients.map((e) => e);
    } else {
      obj.allowedClients = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Params>, I>>(object: I): Params {
    const message = { ...baseParams } as Params;
    message.allowedClients = object.allowedClients?.map((e) => e) || [];
    return message;
  },
};

type Builtin =
  | Date
  | Function
  | Uint8Array
  | string
  | number
  | boolean
  | undefined;

export type DeepPartial<T> = T extends Builtin
  ? T
  : T extends Long
  ? string | number | Long
  : T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U>
  ? ReadonlyArray<DeepPartial<U>>
  : T extends {}
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin
  ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & Record<
        Exclude<keyof I, KeysOfUnion<P>>,
        never
      >;

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}
