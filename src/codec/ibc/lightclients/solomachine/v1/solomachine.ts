/* eslint-disable */
import Long from 'long';
import { Any } from '../../../../google/protobuf/any';
import { ConnectionEnd } from '../../../../ibc/core/connection/v1/connection';
import { Channel } from '../../../../ibc/core/channel/v1/channel';
import _m0 from 'protobufjs/minimal';

export const protobufPackage = 'ibc.lightclients.solomachine.v1';

/**
 * DataType defines the type of solo machine proof being created. This is done to preserve uniqueness of different
 * data sign byte encodings.
 */
export enum DataType {
  /** DATA_TYPE_UNINITIALIZED_UNSPECIFIED - Default State */
  DATA_TYPE_UNINITIALIZED_UNSPECIFIED = 0,
  /** DATA_TYPE_CLIENT_STATE - Data type for client state verification */
  DATA_TYPE_CLIENT_STATE = 1,
  /** DATA_TYPE_CONSENSUS_STATE - Data type for consensus state verification */
  DATA_TYPE_CONSENSUS_STATE = 2,
  /** DATA_TYPE_CONNECTION_STATE - Data type for connection state verification */
  DATA_TYPE_CONNECTION_STATE = 3,
  /** DATA_TYPE_CHANNEL_STATE - Data type for channel state verification */
  DATA_TYPE_CHANNEL_STATE = 4,
  /** DATA_TYPE_PACKET_COMMITMENT - Data type for packet commitment verification */
  DATA_TYPE_PACKET_COMMITMENT = 5,
  /** DATA_TYPE_PACKET_ACKNOWLEDGEMENT - Data type for packet acknowledgement verification */
  DATA_TYPE_PACKET_ACKNOWLEDGEMENT = 6,
  /** DATA_TYPE_PACKET_RECEIPT_ABSENCE - Data type for packet receipt absence verification */
  DATA_TYPE_PACKET_RECEIPT_ABSENCE = 7,
  /** DATA_TYPE_NEXT_SEQUENCE_RECV - Data type for next sequence recv verification */
  DATA_TYPE_NEXT_SEQUENCE_RECV = 8,
  /** DATA_TYPE_HEADER - Data type for header verification */
  DATA_TYPE_HEADER = 9,
  UNRECOGNIZED = -1,
}

export function dataTypeFromJSON(object: any): DataType {
  switch (object) {
    case 0:
    case 'DATA_TYPE_UNINITIALIZED_UNSPECIFIED':
      return DataType.DATA_TYPE_UNINITIALIZED_UNSPECIFIED;
    case 1:
    case 'DATA_TYPE_CLIENT_STATE':
      return DataType.DATA_TYPE_CLIENT_STATE;
    case 2:
    case 'DATA_TYPE_CONSENSUS_STATE':
      return DataType.DATA_TYPE_CONSENSUS_STATE;
    case 3:
    case 'DATA_TYPE_CONNECTION_STATE':
      return DataType.DATA_TYPE_CONNECTION_STATE;
    case 4:
    case 'DATA_TYPE_CHANNEL_STATE':
      return DataType.DATA_TYPE_CHANNEL_STATE;
    case 5:
    case 'DATA_TYPE_PACKET_COMMITMENT':
      return DataType.DATA_TYPE_PACKET_COMMITMENT;
    case 6:
    case 'DATA_TYPE_PACKET_ACKNOWLEDGEMENT':
      return DataType.DATA_TYPE_PACKET_ACKNOWLEDGEMENT;
    case 7:
    case 'DATA_TYPE_PACKET_RECEIPT_ABSENCE':
      return DataType.DATA_TYPE_PACKET_RECEIPT_ABSENCE;
    case 8:
    case 'DATA_TYPE_NEXT_SEQUENCE_RECV':
      return DataType.DATA_TYPE_NEXT_SEQUENCE_RECV;
    case 9:
    case 'DATA_TYPE_HEADER':
      return DataType.DATA_TYPE_HEADER;
    case -1:
    case 'UNRECOGNIZED':
    default:
      return DataType.UNRECOGNIZED;
  }
}

export function dataTypeToJSON(object: DataType): string {
  switch (object) {
    case DataType.DATA_TYPE_UNINITIALIZED_UNSPECIFIED:
      return 'DATA_TYPE_UNINITIALIZED_UNSPECIFIED';
    case DataType.DATA_TYPE_CLIENT_STATE:
      return 'DATA_TYPE_CLIENT_STATE';
    case DataType.DATA_TYPE_CONSENSUS_STATE:
      return 'DATA_TYPE_CONSENSUS_STATE';
    case DataType.DATA_TYPE_CONNECTION_STATE:
      return 'DATA_TYPE_CONNECTION_STATE';
    case DataType.DATA_TYPE_CHANNEL_STATE:
      return 'DATA_TYPE_CHANNEL_STATE';
    case DataType.DATA_TYPE_PACKET_COMMITMENT:
      return 'DATA_TYPE_PACKET_COMMITMENT';
    case DataType.DATA_TYPE_PACKET_ACKNOWLEDGEMENT:
      return 'DATA_TYPE_PACKET_ACKNOWLEDGEMENT';
    case DataType.DATA_TYPE_PACKET_RECEIPT_ABSENCE:
      return 'DATA_TYPE_PACKET_RECEIPT_ABSENCE';
    case DataType.DATA_TYPE_NEXT_SEQUENCE_RECV:
      return 'DATA_TYPE_NEXT_SEQUENCE_RECV';
    case DataType.DATA_TYPE_HEADER:
      return 'DATA_TYPE_HEADER';
    default:
      return 'UNKNOWN';
  }
}

/**
 * ClientState defines a solo machine client that tracks the current consensus
 * state and if the client is frozen.
 */
export interface ClientState {
  /** latest sequence of the client state */
  sequence: Long;
  /** frozen sequence of the solo machine */
  frozenSequence: Long;
  consensusState?: ConsensusState;
  /**
   * when set to true, will allow governance to update a solo machine client.
   * The client will be unfrozen if it is frozen.
   */
  allowUpdateAfterProposal: boolean;
}

/**
 * ConsensusState defines a solo machine consensus state. The sequence of a consensus state
 * is contained in the "height" key used in storing the consensus state.
 */
export interface ConsensusState {
  /** public key of the solo machine */
  publicKey?: Any;
  /**
   * diversifier allows the same public key to be re-used across different solo machine clients
   * (potentially on different chains) without being considered misbehaviour.
   */
  diversifier: string;
  timestamp: Long;
}

/** Header defines a solo machine consensus header */
export interface Header {
  /** sequence to update solo machine public key at */
  sequence: Long;
  timestamp: Long;
  signature: Uint8Array;
  newPublicKey?: Any;
  newDiversifier: string;
}

/**
 * Misbehaviour defines misbehaviour for a solo machine which consists
 * of a sequence and two signatures over different messages at that sequence.
 */
export interface Misbehaviour {
  clientId: string;
  sequence: Long;
  signatureOne?: SignatureAndData;
  signatureTwo?: SignatureAndData;
}

/**
 * SignatureAndData contains a signature and the data signed over to create that
 * signature.
 */
export interface SignatureAndData {
  signature: Uint8Array;
  dataType: DataType;
  data: Uint8Array;
  timestamp: Long;
}

/**
 * TimestampedSignatureData contains the signature data and the timestamp of the
 * signature.
 */
export interface TimestampedSignatureData {
  signatureData: Uint8Array;
  timestamp: Long;
}

/** SignBytes defines the signed bytes used for signature verification. */
export interface SignBytes {
  sequence: Long;
  timestamp: Long;
  diversifier: string;
  /** type of the data used */
  dataType: DataType;
  /** marshaled data */
  data: Uint8Array;
}

/** HeaderData returns the SignBytes data for update verification. */
export interface HeaderData {
  /** header public key */
  newPubKey?: Any;
  /** header diversifier */
  newDiversifier: string;
}

/** ClientStateData returns the SignBytes data for client state verification. */
export interface ClientStateData {
  path: Uint8Array;
  clientState?: Any;
}

/**
 * ConsensusStateData returns the SignBytes data for consensus state
 * verification.
 */
export interface ConsensusStateData {
  path: Uint8Array;
  consensusState?: Any;
}

/**
 * ConnectionStateData returns the SignBytes data for connection state
 * verification.
 */
export interface ConnectionStateData {
  path: Uint8Array;
  connection?: ConnectionEnd;
}

/**
 * ChannelStateData returns the SignBytes data for channel state
 * verification.
 */
export interface ChannelStateData {
  path: Uint8Array;
  channel?: Channel;
}

/**
 * PacketCommitmentData returns the SignBytes data for packet commitment
 * verification.
 */
export interface PacketCommitmentData {
  path: Uint8Array;
  commitment: Uint8Array;
}

/**
 * PacketAcknowledgementData returns the SignBytes data for acknowledgement
 * verification.
 */
export interface PacketAcknowledgementData {
  path: Uint8Array;
  acknowledgement: Uint8Array;
}

/**
 * PacketReceiptAbsenceData returns the SignBytes data for
 * packet receipt absence verification.
 */
export interface PacketReceiptAbsenceData {
  path: Uint8Array;
}

/**
 * NextSequenceRecvData returns the SignBytes data for verification of the next
 * sequence to be received.
 */
export interface NextSequenceRecvData {
  path: Uint8Array;
  nextSeqRecv: Long;
}

const baseClientState: object = {
  sequence: Long.UZERO,
  frozenSequence: Long.UZERO,
  allowUpdateAfterProposal: false,
};

export const ClientState = {
  encode(
    message: ClientState,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (!message.sequence.isZero()) {
      writer.uint32(8).uint64(message.sequence);
    }
    if (!message.frozenSequence.isZero()) {
      writer.uint32(16).uint64(message.frozenSequence);
    }
    if (message.consensusState !== undefined) {
      ConsensusState.encode(
        message.consensusState,
        writer.uint32(26).fork()
      ).ldelim();
    }
    if (message.allowUpdateAfterProposal === true) {
      writer.uint32(32).bool(message.allowUpdateAfterProposal);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ClientState {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseClientState } as ClientState;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sequence = reader.uint64() as Long;
          break;
        case 2:
          message.frozenSequence = reader.uint64() as Long;
          break;
        case 3:
          message.consensusState = ConsensusState.decode(
            reader,
            reader.uint32()
          );
          break;
        case 4:
          message.allowUpdateAfterProposal = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ClientState {
    const message = { ...baseClientState } as ClientState;
    if (object.sequence !== undefined && object.sequence !== null) {
      message.sequence = Long.fromString(object.sequence);
    } else {
      message.sequence = Long.UZERO;
    }
    if (object.frozenSequence !== undefined && object.frozenSequence !== null) {
      message.frozenSequence = Long.fromString(object.frozenSequence);
    } else {
      message.frozenSequence = Long.UZERO;
    }
    if (object.consensusState !== undefined && object.consensusState !== null) {
      message.consensusState = ConsensusState.fromJSON(object.consensusState);
    } else {
      message.consensusState = undefined;
    }
    if (
      object.allowUpdateAfterProposal !== undefined &&
      object.allowUpdateAfterProposal !== null
    ) {
      message.allowUpdateAfterProposal = Boolean(
        object.allowUpdateAfterProposal
      );
    } else {
      message.allowUpdateAfterProposal = false;
    }
    return message;
  },

  toJSON(message: ClientState): unknown {
    const obj: any = {};
    message.sequence !== undefined &&
      (obj.sequence = (message.sequence || Long.UZERO).toString());
    message.frozenSequence !== undefined &&
      (obj.frozenSequence = (message.frozenSequence || Long.UZERO).toString());
    message.consensusState !== undefined &&
      (obj.consensusState = message.consensusState
        ? ConsensusState.toJSON(message.consensusState)
        : undefined);
    message.allowUpdateAfterProposal !== undefined &&
      (obj.allowUpdateAfterProposal = message.allowUpdateAfterProposal);
    return obj;
  },

  fromPartial(object: DeepPartial<ClientState>): ClientState {
    const message = { ...baseClientState } as ClientState;
    if (object.sequence !== undefined && object.sequence !== null) {
      message.sequence = object.sequence as Long;
    } else {
      message.sequence = Long.UZERO;
    }
    if (object.frozenSequence !== undefined && object.frozenSequence !== null) {
      message.frozenSequence = object.frozenSequence as Long;
    } else {
      message.frozenSequence = Long.UZERO;
    }
    if (object.consensusState !== undefined && object.consensusState !== null) {
      message.consensusState = ConsensusState.fromPartial(
        object.consensusState
      );
    } else {
      message.consensusState = undefined;
    }
    if (
      object.allowUpdateAfterProposal !== undefined &&
      object.allowUpdateAfterProposal !== null
    ) {
      message.allowUpdateAfterProposal = object.allowUpdateAfterProposal;
    } else {
      message.allowUpdateAfterProposal = false;
    }
    return message;
  },
};

const baseConsensusState: object = { diversifier: '', timestamp: Long.UZERO };

export const ConsensusState = {
  encode(
    message: ConsensusState,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.publicKey !== undefined) {
      Any.encode(message.publicKey, writer.uint32(10).fork()).ldelim();
    }
    if (message.diversifier !== '') {
      writer.uint32(18).string(message.diversifier);
    }
    if (!message.timestamp.isZero()) {
      writer.uint32(24).uint64(message.timestamp);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ConsensusState {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseConsensusState } as ConsensusState;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.publicKey = Any.decode(reader, reader.uint32());
          break;
        case 2:
          message.diversifier = reader.string();
          break;
        case 3:
          message.timestamp = reader.uint64() as Long;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ConsensusState {
    const message = { ...baseConsensusState } as ConsensusState;
    if (object.publicKey !== undefined && object.publicKey !== null) {
      message.publicKey = Any.fromJSON(object.publicKey);
    } else {
      message.publicKey = undefined;
    }
    if (object.diversifier !== undefined && object.diversifier !== null) {
      message.diversifier = String(object.diversifier);
    } else {
      message.diversifier = '';
    }
    if (object.timestamp !== undefined && object.timestamp !== null) {
      message.timestamp = Long.fromString(object.timestamp);
    } else {
      message.timestamp = Long.UZERO;
    }
    return message;
  },

  toJSON(message: ConsensusState): unknown {
    const obj: any = {};
    message.publicKey !== undefined &&
      (obj.publicKey = message.publicKey
        ? Any.toJSON(message.publicKey)
        : undefined);
    message.diversifier !== undefined &&
      (obj.diversifier = message.diversifier);
    message.timestamp !== undefined &&
      (obj.timestamp = (message.timestamp || Long.UZERO).toString());
    return obj;
  },

  fromPartial(object: DeepPartial<ConsensusState>): ConsensusState {
    const message = { ...baseConsensusState } as ConsensusState;
    if (object.publicKey !== undefined && object.publicKey !== null) {
      message.publicKey = Any.fromPartial(object.publicKey);
    } else {
      message.publicKey = undefined;
    }
    if (object.diversifier !== undefined && object.diversifier !== null) {
      message.diversifier = object.diversifier;
    } else {
      message.diversifier = '';
    }
    if (object.timestamp !== undefined && object.timestamp !== null) {
      message.timestamp = object.timestamp as Long;
    } else {
      message.timestamp = Long.UZERO;
    }
    return message;
  },
};

const baseHeader: object = {
  sequence: Long.UZERO,
  timestamp: Long.UZERO,
  newDiversifier: '',
};

export const Header = {
  encode(
    message: Header,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (!message.sequence.isZero()) {
      writer.uint32(8).uint64(message.sequence);
    }
    if (!message.timestamp.isZero()) {
      writer.uint32(16).uint64(message.timestamp);
    }
    if (message.signature.length !== 0) {
      writer.uint32(26).bytes(message.signature);
    }
    if (message.newPublicKey !== undefined) {
      Any.encode(message.newPublicKey, writer.uint32(34).fork()).ldelim();
    }
    if (message.newDiversifier !== '') {
      writer.uint32(42).string(message.newDiversifier);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Header {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseHeader } as Header;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sequence = reader.uint64() as Long;
          break;
        case 2:
          message.timestamp = reader.uint64() as Long;
          break;
        case 3:
          message.signature = reader.bytes();
          break;
        case 4:
          message.newPublicKey = Any.decode(reader, reader.uint32());
          break;
        case 5:
          message.newDiversifier = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Header {
    const message = { ...baseHeader } as Header;
    if (object.sequence !== undefined && object.sequence !== null) {
      message.sequence = Long.fromString(object.sequence);
    } else {
      message.sequence = Long.UZERO;
    }
    if (object.timestamp !== undefined && object.timestamp !== null) {
      message.timestamp = Long.fromString(object.timestamp);
    } else {
      message.timestamp = Long.UZERO;
    }
    if (object.signature !== undefined && object.signature !== null) {
      message.signature = bytesFromBase64(object.signature);
    }
    if (object.newPublicKey !== undefined && object.newPublicKey !== null) {
      message.newPublicKey = Any.fromJSON(object.newPublicKey);
    } else {
      message.newPublicKey = undefined;
    }
    if (object.newDiversifier !== undefined && object.newDiversifier !== null) {
      message.newDiversifier = String(object.newDiversifier);
    } else {
      message.newDiversifier = '';
    }
    return message;
  },

  toJSON(message: Header): unknown {
    const obj: any = {};
    message.sequence !== undefined &&
      (obj.sequence = (message.sequence || Long.UZERO).toString());
    message.timestamp !== undefined &&
      (obj.timestamp = (message.timestamp || Long.UZERO).toString());
    message.signature !== undefined &&
      (obj.signature = base64FromBytes(
        message.signature !== undefined ? message.signature : new Uint8Array()
      ));
    message.newPublicKey !== undefined &&
      (obj.newPublicKey = message.newPublicKey
        ? Any.toJSON(message.newPublicKey)
        : undefined);
    message.newDiversifier !== undefined &&
      (obj.newDiversifier = message.newDiversifier);
    return obj;
  },

  fromPartial(object: DeepPartial<Header>): Header {
    const message = { ...baseHeader } as Header;
    if (object.sequence !== undefined && object.sequence !== null) {
      message.sequence = object.sequence as Long;
    } else {
      message.sequence = Long.UZERO;
    }
    if (object.timestamp !== undefined && object.timestamp !== null) {
      message.timestamp = object.timestamp as Long;
    } else {
      message.timestamp = Long.UZERO;
    }
    if (object.signature !== undefined && object.signature !== null) {
      message.signature = object.signature;
    } else {
      message.signature = new Uint8Array();
    }
    if (object.newPublicKey !== undefined && object.newPublicKey !== null) {
      message.newPublicKey = Any.fromPartial(object.newPublicKey);
    } else {
      message.newPublicKey = undefined;
    }
    if (object.newDiversifier !== undefined && object.newDiversifier !== null) {
      message.newDiversifier = object.newDiversifier;
    } else {
      message.newDiversifier = '';
    }
    return message;
  },
};

const baseMisbehaviour: object = { clientId: '', sequence: Long.UZERO };

export const Misbehaviour = {
  encode(
    message: Misbehaviour,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.clientId !== '') {
      writer.uint32(10).string(message.clientId);
    }
    if (!message.sequence.isZero()) {
      writer.uint32(16).uint64(message.sequence);
    }
    if (message.signatureOne !== undefined) {
      SignatureAndData.encode(
        message.signatureOne,
        writer.uint32(26).fork()
      ).ldelim();
    }
    if (message.signatureTwo !== undefined) {
      SignatureAndData.encode(
        message.signatureTwo,
        writer.uint32(34).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Misbehaviour {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseMisbehaviour } as Misbehaviour;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.clientId = reader.string();
          break;
        case 2:
          message.sequence = reader.uint64() as Long;
          break;
        case 3:
          message.signatureOne = SignatureAndData.decode(
            reader,
            reader.uint32()
          );
          break;
        case 4:
          message.signatureTwo = SignatureAndData.decode(
            reader,
            reader.uint32()
          );
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Misbehaviour {
    const message = { ...baseMisbehaviour } as Misbehaviour;
    if (object.clientId !== undefined && object.clientId !== null) {
      message.clientId = String(object.clientId);
    } else {
      message.clientId = '';
    }
    if (object.sequence !== undefined && object.sequence !== null) {
      message.sequence = Long.fromString(object.sequence);
    } else {
      message.sequence = Long.UZERO;
    }
    if (object.signatureOne !== undefined && object.signatureOne !== null) {
      message.signatureOne = SignatureAndData.fromJSON(object.signatureOne);
    } else {
      message.signatureOne = undefined;
    }
    if (object.signatureTwo !== undefined && object.signatureTwo !== null) {
      message.signatureTwo = SignatureAndData.fromJSON(object.signatureTwo);
    } else {
      message.signatureTwo = undefined;
    }
    return message;
  },

  toJSON(message: Misbehaviour): unknown {
    const obj: any = {};
    message.clientId !== undefined && (obj.clientId = message.clientId);
    message.sequence !== undefined &&
      (obj.sequence = (message.sequence || Long.UZERO).toString());
    message.signatureOne !== undefined &&
      (obj.signatureOne = message.signatureOne
        ? SignatureAndData.toJSON(message.signatureOne)
        : undefined);
    message.signatureTwo !== undefined &&
      (obj.signatureTwo = message.signatureTwo
        ? SignatureAndData.toJSON(message.signatureTwo)
        : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<Misbehaviour>): Misbehaviour {
    const message = { ...baseMisbehaviour } as Misbehaviour;
    if (object.clientId !== undefined && object.clientId !== null) {
      message.clientId = object.clientId;
    } else {
      message.clientId = '';
    }
    if (object.sequence !== undefined && object.sequence !== null) {
      message.sequence = object.sequence as Long;
    } else {
      message.sequence = Long.UZERO;
    }
    if (object.signatureOne !== undefined && object.signatureOne !== null) {
      message.signatureOne = SignatureAndData.fromPartial(object.signatureOne);
    } else {
      message.signatureOne = undefined;
    }
    if (object.signatureTwo !== undefined && object.signatureTwo !== null) {
      message.signatureTwo = SignatureAndData.fromPartial(object.signatureTwo);
    } else {
      message.signatureTwo = undefined;
    }
    return message;
  },
};

const baseSignatureAndData: object = { dataType: 0, timestamp: Long.UZERO };

export const SignatureAndData = {
  encode(
    message: SignatureAndData,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.signature.length !== 0) {
      writer.uint32(10).bytes(message.signature);
    }
    if (message.dataType !== 0) {
      writer.uint32(16).int32(message.dataType);
    }
    if (message.data.length !== 0) {
      writer.uint32(26).bytes(message.data);
    }
    if (!message.timestamp.isZero()) {
      writer.uint32(32).uint64(message.timestamp);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SignatureAndData {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseSignatureAndData } as SignatureAndData;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.signature = reader.bytes();
          break;
        case 2:
          message.dataType = reader.int32() as any;
          break;
        case 3:
          message.data = reader.bytes();
          break;
        case 4:
          message.timestamp = reader.uint64() as Long;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SignatureAndData {
    const message = { ...baseSignatureAndData } as SignatureAndData;
    if (object.signature !== undefined && object.signature !== null) {
      message.signature = bytesFromBase64(object.signature);
    }
    if (object.dataType !== undefined && object.dataType !== null) {
      message.dataType = dataTypeFromJSON(object.dataType);
    } else {
      message.dataType = 0;
    }
    if (object.data !== undefined && object.data !== null) {
      message.data = bytesFromBase64(object.data);
    }
    if (object.timestamp !== undefined && object.timestamp !== null) {
      message.timestamp = Long.fromString(object.timestamp);
    } else {
      message.timestamp = Long.UZERO;
    }
    return message;
  },

  toJSON(message: SignatureAndData): unknown {
    const obj: any = {};
    message.signature !== undefined &&
      (obj.signature = base64FromBytes(
        message.signature !== undefined ? message.signature : new Uint8Array()
      ));
    message.dataType !== undefined &&
      (obj.dataType = dataTypeToJSON(message.dataType));
    message.data !== undefined &&
      (obj.data = base64FromBytes(
        message.data !== undefined ? message.data : new Uint8Array()
      ));
    message.timestamp !== undefined &&
      (obj.timestamp = (message.timestamp || Long.UZERO).toString());
    return obj;
  },

  fromPartial(object: DeepPartial<SignatureAndData>): SignatureAndData {
    const message = { ...baseSignatureAndData } as SignatureAndData;
    if (object.signature !== undefined && object.signature !== null) {
      message.signature = object.signature;
    } else {
      message.signature = new Uint8Array();
    }
    if (object.dataType !== undefined && object.dataType !== null) {
      message.dataType = object.dataType;
    } else {
      message.dataType = 0;
    }
    if (object.data !== undefined && object.data !== null) {
      message.data = object.data;
    } else {
      message.data = new Uint8Array();
    }
    if (object.timestamp !== undefined && object.timestamp !== null) {
      message.timestamp = object.timestamp as Long;
    } else {
      message.timestamp = Long.UZERO;
    }
    return message;
  },
};

const baseTimestampedSignatureData: object = { timestamp: Long.UZERO };

export const TimestampedSignatureData = {
  encode(
    message: TimestampedSignatureData,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.signatureData.length !== 0) {
      writer.uint32(10).bytes(message.signatureData);
    }
    if (!message.timestamp.isZero()) {
      writer.uint32(16).uint64(message.timestamp);
    }
    return writer;
  },

  decode(
    input: _m0.Reader | Uint8Array,
    length?: number
  ): TimestampedSignatureData {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = {
      ...baseTimestampedSignatureData,
    } as TimestampedSignatureData;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.signatureData = reader.bytes();
          break;
        case 2:
          message.timestamp = reader.uint64() as Long;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): TimestampedSignatureData {
    const message = {
      ...baseTimestampedSignatureData,
    } as TimestampedSignatureData;
    if (object.signatureData !== undefined && object.signatureData !== null) {
      message.signatureData = bytesFromBase64(object.signatureData);
    }
    if (object.timestamp !== undefined && object.timestamp !== null) {
      message.timestamp = Long.fromString(object.timestamp);
    } else {
      message.timestamp = Long.UZERO;
    }
    return message;
  },

  toJSON(message: TimestampedSignatureData): unknown {
    const obj: any = {};
    message.signatureData !== undefined &&
      (obj.signatureData = base64FromBytes(
        message.signatureData !== undefined
          ? message.signatureData
          : new Uint8Array()
      ));
    message.timestamp !== undefined &&
      (obj.timestamp = (message.timestamp || Long.UZERO).toString());
    return obj;
  },

  fromPartial(
    object: DeepPartial<TimestampedSignatureData>
  ): TimestampedSignatureData {
    const message = {
      ...baseTimestampedSignatureData,
    } as TimestampedSignatureData;
    if (object.signatureData !== undefined && object.signatureData !== null) {
      message.signatureData = object.signatureData;
    } else {
      message.signatureData = new Uint8Array();
    }
    if (object.timestamp !== undefined && object.timestamp !== null) {
      message.timestamp = object.timestamp as Long;
    } else {
      message.timestamp = Long.UZERO;
    }
    return message;
  },
};

const baseSignBytes: object = {
  sequence: Long.UZERO,
  timestamp: Long.UZERO,
  diversifier: '',
  dataType: 0,
};

export const SignBytes = {
  encode(
    message: SignBytes,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (!message.sequence.isZero()) {
      writer.uint32(8).uint64(message.sequence);
    }
    if (!message.timestamp.isZero()) {
      writer.uint32(16).uint64(message.timestamp);
    }
    if (message.diversifier !== '') {
      writer.uint32(26).string(message.diversifier);
    }
    if (message.dataType !== 0) {
      writer.uint32(32).int32(message.dataType);
    }
    if (message.data.length !== 0) {
      writer.uint32(42).bytes(message.data);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SignBytes {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseSignBytes } as SignBytes;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sequence = reader.uint64() as Long;
          break;
        case 2:
          message.timestamp = reader.uint64() as Long;
          break;
        case 3:
          message.diversifier = reader.string();
          break;
        case 4:
          message.dataType = reader.int32() as any;
          break;
        case 5:
          message.data = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SignBytes {
    const message = { ...baseSignBytes } as SignBytes;
    if (object.sequence !== undefined && object.sequence !== null) {
      message.sequence = Long.fromString(object.sequence);
    } else {
      message.sequence = Long.UZERO;
    }
    if (object.timestamp !== undefined && object.timestamp !== null) {
      message.timestamp = Long.fromString(object.timestamp);
    } else {
      message.timestamp = Long.UZERO;
    }
    if (object.diversifier !== undefined && object.diversifier !== null) {
      message.diversifier = String(object.diversifier);
    } else {
      message.diversifier = '';
    }
    if (object.dataType !== undefined && object.dataType !== null) {
      message.dataType = dataTypeFromJSON(object.dataType);
    } else {
      message.dataType = 0;
    }
    if (object.data !== undefined && object.data !== null) {
      message.data = bytesFromBase64(object.data);
    }
    return message;
  },

  toJSON(message: SignBytes): unknown {
    const obj: any = {};
    message.sequence !== undefined &&
      (obj.sequence = (message.sequence || Long.UZERO).toString());
    message.timestamp !== undefined &&
      (obj.timestamp = (message.timestamp || Long.UZERO).toString());
    message.diversifier !== undefined &&
      (obj.diversifier = message.diversifier);
    message.dataType !== undefined &&
      (obj.dataType = dataTypeToJSON(message.dataType));
    message.data !== undefined &&
      (obj.data = base64FromBytes(
        message.data !== undefined ? message.data : new Uint8Array()
      ));
    return obj;
  },

  fromPartial(object: DeepPartial<SignBytes>): SignBytes {
    const message = { ...baseSignBytes } as SignBytes;
    if (object.sequence !== undefined && object.sequence !== null) {
      message.sequence = object.sequence as Long;
    } else {
      message.sequence = Long.UZERO;
    }
    if (object.timestamp !== undefined && object.timestamp !== null) {
      message.timestamp = object.timestamp as Long;
    } else {
      message.timestamp = Long.UZERO;
    }
    if (object.diversifier !== undefined && object.diversifier !== null) {
      message.diversifier = object.diversifier;
    } else {
      message.diversifier = '';
    }
    if (object.dataType !== undefined && object.dataType !== null) {
      message.dataType = object.dataType;
    } else {
      message.dataType = 0;
    }
    if (object.data !== undefined && object.data !== null) {
      message.data = object.data;
    } else {
      message.data = new Uint8Array();
    }
    return message;
  },
};

const baseHeaderData: object = { newDiversifier: '' };

export const HeaderData = {
  encode(
    message: HeaderData,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.newPubKey !== undefined) {
      Any.encode(message.newPubKey, writer.uint32(10).fork()).ldelim();
    }
    if (message.newDiversifier !== '') {
      writer.uint32(18).string(message.newDiversifier);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): HeaderData {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseHeaderData } as HeaderData;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.newPubKey = Any.decode(reader, reader.uint32());
          break;
        case 2:
          message.newDiversifier = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): HeaderData {
    const message = { ...baseHeaderData } as HeaderData;
    if (object.newPubKey !== undefined && object.newPubKey !== null) {
      message.newPubKey = Any.fromJSON(object.newPubKey);
    } else {
      message.newPubKey = undefined;
    }
    if (object.newDiversifier !== undefined && object.newDiversifier !== null) {
      message.newDiversifier = String(object.newDiversifier);
    } else {
      message.newDiversifier = '';
    }
    return message;
  },

  toJSON(message: HeaderData): unknown {
    const obj: any = {};
    message.newPubKey !== undefined &&
      (obj.newPubKey = message.newPubKey
        ? Any.toJSON(message.newPubKey)
        : undefined);
    message.newDiversifier !== undefined &&
      (obj.newDiversifier = message.newDiversifier);
    return obj;
  },

  fromPartial(object: DeepPartial<HeaderData>): HeaderData {
    const message = { ...baseHeaderData } as HeaderData;
    if (object.newPubKey !== undefined && object.newPubKey !== null) {
      message.newPubKey = Any.fromPartial(object.newPubKey);
    } else {
      message.newPubKey = undefined;
    }
    if (object.newDiversifier !== undefined && object.newDiversifier !== null) {
      message.newDiversifier = object.newDiversifier;
    } else {
      message.newDiversifier = '';
    }
    return message;
  },
};

const baseClientStateData: object = {};

export const ClientStateData = {
  encode(
    message: ClientStateData,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.path.length !== 0) {
      writer.uint32(10).bytes(message.path);
    }
    if (message.clientState !== undefined) {
      Any.encode(message.clientState, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ClientStateData {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseClientStateData } as ClientStateData;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.path = reader.bytes();
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

  fromJSON(object: any): ClientStateData {
    const message = { ...baseClientStateData } as ClientStateData;
    if (object.path !== undefined && object.path !== null) {
      message.path = bytesFromBase64(object.path);
    }
    if (object.clientState !== undefined && object.clientState !== null) {
      message.clientState = Any.fromJSON(object.clientState);
    } else {
      message.clientState = undefined;
    }
    return message;
  },

  toJSON(message: ClientStateData): unknown {
    const obj: any = {};
    message.path !== undefined &&
      (obj.path = base64FromBytes(
        message.path !== undefined ? message.path : new Uint8Array()
      ));
    message.clientState !== undefined &&
      (obj.clientState = message.clientState
        ? Any.toJSON(message.clientState)
        : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<ClientStateData>): ClientStateData {
    const message = { ...baseClientStateData } as ClientStateData;
    if (object.path !== undefined && object.path !== null) {
      message.path = object.path;
    } else {
      message.path = new Uint8Array();
    }
    if (object.clientState !== undefined && object.clientState !== null) {
      message.clientState = Any.fromPartial(object.clientState);
    } else {
      message.clientState = undefined;
    }
    return message;
  },
};

const baseConsensusStateData: object = {};

export const ConsensusStateData = {
  encode(
    message: ConsensusStateData,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.path.length !== 0) {
      writer.uint32(10).bytes(message.path);
    }
    if (message.consensusState !== undefined) {
      Any.encode(message.consensusState, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ConsensusStateData {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseConsensusStateData } as ConsensusStateData;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.path = reader.bytes();
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

  fromJSON(object: any): ConsensusStateData {
    const message = { ...baseConsensusStateData } as ConsensusStateData;
    if (object.path !== undefined && object.path !== null) {
      message.path = bytesFromBase64(object.path);
    }
    if (object.consensusState !== undefined && object.consensusState !== null) {
      message.consensusState = Any.fromJSON(object.consensusState);
    } else {
      message.consensusState = undefined;
    }
    return message;
  },

  toJSON(message: ConsensusStateData): unknown {
    const obj: any = {};
    message.path !== undefined &&
      (obj.path = base64FromBytes(
        message.path !== undefined ? message.path : new Uint8Array()
      ));
    message.consensusState !== undefined &&
      (obj.consensusState = message.consensusState
        ? Any.toJSON(message.consensusState)
        : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<ConsensusStateData>): ConsensusStateData {
    const message = { ...baseConsensusStateData } as ConsensusStateData;
    if (object.path !== undefined && object.path !== null) {
      message.path = object.path;
    } else {
      message.path = new Uint8Array();
    }
    if (object.consensusState !== undefined && object.consensusState !== null) {
      message.consensusState = Any.fromPartial(object.consensusState);
    } else {
      message.consensusState = undefined;
    }
    return message;
  },
};

const baseConnectionStateData: object = {};

export const ConnectionStateData = {
  encode(
    message: ConnectionStateData,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.path.length !== 0) {
      writer.uint32(10).bytes(message.path);
    }
    if (message.connection !== undefined) {
      ConnectionEnd.encode(
        message.connection,
        writer.uint32(18).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ConnectionStateData {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseConnectionStateData } as ConnectionStateData;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.path = reader.bytes();
          break;
        case 2:
          message.connection = ConnectionEnd.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ConnectionStateData {
    const message = { ...baseConnectionStateData } as ConnectionStateData;
    if (object.path !== undefined && object.path !== null) {
      message.path = bytesFromBase64(object.path);
    }
    if (object.connection !== undefined && object.connection !== null) {
      message.connection = ConnectionEnd.fromJSON(object.connection);
    } else {
      message.connection = undefined;
    }
    return message;
  },

  toJSON(message: ConnectionStateData): unknown {
    const obj: any = {};
    message.path !== undefined &&
      (obj.path = base64FromBytes(
        message.path !== undefined ? message.path : new Uint8Array()
      ));
    message.connection !== undefined &&
      (obj.connection = message.connection
        ? ConnectionEnd.toJSON(message.connection)
        : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<ConnectionStateData>): ConnectionStateData {
    const message = { ...baseConnectionStateData } as ConnectionStateData;
    if (object.path !== undefined && object.path !== null) {
      message.path = object.path;
    } else {
      message.path = new Uint8Array();
    }
    if (object.connection !== undefined && object.connection !== null) {
      message.connection = ConnectionEnd.fromPartial(object.connection);
    } else {
      message.connection = undefined;
    }
    return message;
  },
};

const baseChannelStateData: object = {};

export const ChannelStateData = {
  encode(
    message: ChannelStateData,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.path.length !== 0) {
      writer.uint32(10).bytes(message.path);
    }
    if (message.channel !== undefined) {
      Channel.encode(message.channel, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ChannelStateData {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseChannelStateData } as ChannelStateData;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.path = reader.bytes();
          break;
        case 2:
          message.channel = Channel.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ChannelStateData {
    const message = { ...baseChannelStateData } as ChannelStateData;
    if (object.path !== undefined && object.path !== null) {
      message.path = bytesFromBase64(object.path);
    }
    if (object.channel !== undefined && object.channel !== null) {
      message.channel = Channel.fromJSON(object.channel);
    } else {
      message.channel = undefined;
    }
    return message;
  },

  toJSON(message: ChannelStateData): unknown {
    const obj: any = {};
    message.path !== undefined &&
      (obj.path = base64FromBytes(
        message.path !== undefined ? message.path : new Uint8Array()
      ));
    message.channel !== undefined &&
      (obj.channel = message.channel
        ? Channel.toJSON(message.channel)
        : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<ChannelStateData>): ChannelStateData {
    const message = { ...baseChannelStateData } as ChannelStateData;
    if (object.path !== undefined && object.path !== null) {
      message.path = object.path;
    } else {
      message.path = new Uint8Array();
    }
    if (object.channel !== undefined && object.channel !== null) {
      message.channel = Channel.fromPartial(object.channel);
    } else {
      message.channel = undefined;
    }
    return message;
  },
};

const basePacketCommitmentData: object = {};

export const PacketCommitmentData = {
  encode(
    message: PacketCommitmentData,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.path.length !== 0) {
      writer.uint32(10).bytes(message.path);
    }
    if (message.commitment.length !== 0) {
      writer.uint32(18).bytes(message.commitment);
    }
    return writer;
  },

  decode(
    input: _m0.Reader | Uint8Array,
    length?: number
  ): PacketCommitmentData {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...basePacketCommitmentData } as PacketCommitmentData;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.path = reader.bytes();
          break;
        case 2:
          message.commitment = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PacketCommitmentData {
    const message = { ...basePacketCommitmentData } as PacketCommitmentData;
    if (object.path !== undefined && object.path !== null) {
      message.path = bytesFromBase64(object.path);
    }
    if (object.commitment !== undefined && object.commitment !== null) {
      message.commitment = bytesFromBase64(object.commitment);
    }
    return message;
  },

  toJSON(message: PacketCommitmentData): unknown {
    const obj: any = {};
    message.path !== undefined &&
      (obj.path = base64FromBytes(
        message.path !== undefined ? message.path : new Uint8Array()
      ));
    message.commitment !== undefined &&
      (obj.commitment = base64FromBytes(
        message.commitment !== undefined ? message.commitment : new Uint8Array()
      ));
    return obj;
  },

  fromPartial(object: DeepPartial<PacketCommitmentData>): PacketCommitmentData {
    const message = { ...basePacketCommitmentData } as PacketCommitmentData;
    if (object.path !== undefined && object.path !== null) {
      message.path = object.path;
    } else {
      message.path = new Uint8Array();
    }
    if (object.commitment !== undefined && object.commitment !== null) {
      message.commitment = object.commitment;
    } else {
      message.commitment = new Uint8Array();
    }
    return message;
  },
};

const basePacketAcknowledgementData: object = {};

export const PacketAcknowledgementData = {
  encode(
    message: PacketAcknowledgementData,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.path.length !== 0) {
      writer.uint32(10).bytes(message.path);
    }
    if (message.acknowledgement.length !== 0) {
      writer.uint32(18).bytes(message.acknowledgement);
    }
    return writer;
  },

  decode(
    input: _m0.Reader | Uint8Array,
    length?: number
  ): PacketAcknowledgementData {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = {
      ...basePacketAcknowledgementData,
    } as PacketAcknowledgementData;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.path = reader.bytes();
          break;
        case 2:
          message.acknowledgement = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PacketAcknowledgementData {
    const message = {
      ...basePacketAcknowledgementData,
    } as PacketAcknowledgementData;
    if (object.path !== undefined && object.path !== null) {
      message.path = bytesFromBase64(object.path);
    }
    if (
      object.acknowledgement !== undefined &&
      object.acknowledgement !== null
    ) {
      message.acknowledgement = bytesFromBase64(object.acknowledgement);
    }
    return message;
  },

  toJSON(message: PacketAcknowledgementData): unknown {
    const obj: any = {};
    message.path !== undefined &&
      (obj.path = base64FromBytes(
        message.path !== undefined ? message.path : new Uint8Array()
      ));
    message.acknowledgement !== undefined &&
      (obj.acknowledgement = base64FromBytes(
        message.acknowledgement !== undefined
          ? message.acknowledgement
          : new Uint8Array()
      ));
    return obj;
  },

  fromPartial(
    object: DeepPartial<PacketAcknowledgementData>
  ): PacketAcknowledgementData {
    const message = {
      ...basePacketAcknowledgementData,
    } as PacketAcknowledgementData;
    if (object.path !== undefined && object.path !== null) {
      message.path = object.path;
    } else {
      message.path = new Uint8Array();
    }
    if (
      object.acknowledgement !== undefined &&
      object.acknowledgement !== null
    ) {
      message.acknowledgement = object.acknowledgement;
    } else {
      message.acknowledgement = new Uint8Array();
    }
    return message;
  },
};

const basePacketReceiptAbsenceData: object = {};

export const PacketReceiptAbsenceData = {
  encode(
    message: PacketReceiptAbsenceData,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.path.length !== 0) {
      writer.uint32(10).bytes(message.path);
    }
    return writer;
  },

  decode(
    input: _m0.Reader | Uint8Array,
    length?: number
  ): PacketReceiptAbsenceData {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = {
      ...basePacketReceiptAbsenceData,
    } as PacketReceiptAbsenceData;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.path = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PacketReceiptAbsenceData {
    const message = {
      ...basePacketReceiptAbsenceData,
    } as PacketReceiptAbsenceData;
    if (object.path !== undefined && object.path !== null) {
      message.path = bytesFromBase64(object.path);
    }
    return message;
  },

  toJSON(message: PacketReceiptAbsenceData): unknown {
    const obj: any = {};
    message.path !== undefined &&
      (obj.path = base64FromBytes(
        message.path !== undefined ? message.path : new Uint8Array()
      ));
    return obj;
  },

  fromPartial(
    object: DeepPartial<PacketReceiptAbsenceData>
  ): PacketReceiptAbsenceData {
    const message = {
      ...basePacketReceiptAbsenceData,
    } as PacketReceiptAbsenceData;
    if (object.path !== undefined && object.path !== null) {
      message.path = object.path;
    } else {
      message.path = new Uint8Array();
    }
    return message;
  },
};

const baseNextSequenceRecvData: object = { nextSeqRecv: Long.UZERO };

export const NextSequenceRecvData = {
  encode(
    message: NextSequenceRecvData,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.path.length !== 0) {
      writer.uint32(10).bytes(message.path);
    }
    if (!message.nextSeqRecv.isZero()) {
      writer.uint32(16).uint64(message.nextSeqRecv);
    }
    return writer;
  },

  decode(
    input: _m0.Reader | Uint8Array,
    length?: number
  ): NextSequenceRecvData {
    const reader = input instanceof Uint8Array ? new _m0.Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseNextSequenceRecvData } as NextSequenceRecvData;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.path = reader.bytes();
          break;
        case 2:
          message.nextSeqRecv = reader.uint64() as Long;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): NextSequenceRecvData {
    const message = { ...baseNextSequenceRecvData } as NextSequenceRecvData;
    if (object.path !== undefined && object.path !== null) {
      message.path = bytesFromBase64(object.path);
    }
    if (object.nextSeqRecv !== undefined && object.nextSeqRecv !== null) {
      message.nextSeqRecv = Long.fromString(object.nextSeqRecv);
    } else {
      message.nextSeqRecv = Long.UZERO;
    }
    return message;
  },

  toJSON(message: NextSequenceRecvData): unknown {
    const obj: any = {};
    message.path !== undefined &&
      (obj.path = base64FromBytes(
        message.path !== undefined ? message.path : new Uint8Array()
      ));
    message.nextSeqRecv !== undefined &&
      (obj.nextSeqRecv = (message.nextSeqRecv || Long.UZERO).toString());
    return obj;
  },

  fromPartial(object: DeepPartial<NextSequenceRecvData>): NextSequenceRecvData {
    const message = { ...baseNextSequenceRecvData } as NextSequenceRecvData;
    if (object.path !== undefined && object.path !== null) {
      message.path = object.path;
    } else {
      message.path = new Uint8Array();
    }
    if (object.nextSeqRecv !== undefined && object.nextSeqRecv !== null) {
      message.nextSeqRecv = object.nextSeqRecv as Long;
    } else {
      message.nextSeqRecv = Long.UZERO;
    }
    return message;
  },
};

declare var self: any | undefined;
declare var window: any | undefined;
var globalThis: any = (() => {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof self !== 'undefined') return self;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  throw 'Unable to locate global object';
})();

const atob: (b64: string) => string =
  globalThis.atob ||
  ((b64) => globalThis.Buffer.from(b64, 'base64').toString('binary'));
function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; ++i) {
    arr[i] = bin.charCodeAt(i);
  }
  return arr;
}

const btoa: (bin: string) => string =
  globalThis.btoa ||
  ((bin) => globalThis.Buffer.from(bin, 'binary').toString('base64'));
function base64FromBytes(arr: Uint8Array): string {
  const bin: string[] = [];
  for (let i = 0; i < arr.byteLength; ++i) {
    bin.push(String.fromCharCode(arr[i]));
  }
  return btoa(bin.join(''));
}

type Builtin =
  | Date
  | Function
  | Uint8Array
  | string
  | number
  | undefined
  | Long;
export type DeepPartial<T> = T extends Builtin
  ? T
  : T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U>
  ? ReadonlyArray<DeepPartial<U>>
  : T extends {}
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
