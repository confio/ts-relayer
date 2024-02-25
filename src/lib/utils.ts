import { fromUtf8, toHex, toUtf8 } from "@cosmjs/encoding";
import {
  DeliverTxResponse,
  Event,
  fromTendermintEvent,
} from "@cosmjs/stargate";
import {
  ReadonlyDateWithNanoseconds,
  ValidatorPubkey as RpcPubKey,
  tendermint34,
  tendermint37,
} from "@cosmjs/tendermint-rpc";
import { HashOp, LengthOp } from "cosmjs-types/cosmos/ics23/v1/proofs";
import { Timestamp } from "cosmjs-types/google/protobuf/timestamp";
import { Packet } from "cosmjs-types/ibc/core/channel/v1/channel";
import { Height } from "cosmjs-types/ibc/core/client/v1/client";
import {
  ClientState as TendermintClientState,
  ConsensusState as TendermintConsensusState,
} from "cosmjs-types/ibc/lightclients/tendermint/v1/tendermint";
import { PublicKey as ProtoPubKey } from "cosmjs-types/tendermint/crypto/keys";

import { PacketWithMetadata } from "./endpoint";

export interface Ack {
  readonly acknowledgement: Uint8Array;
  readonly originalPacket: Packet;
}

export function createDeliverTxFailureMessage(
  result: DeliverTxResponse,
): string {
  return `Error when broadcasting tx ${result.transactionHash} at height ${result.height}. Code: ${result.code}; Raw log: ${result.rawLog}`;
}

export function toIntHeight(height?: Height): number {
  return Number(height?.revisionHeight) ?? 0;
}

export function ensureIntHeight(height: bigint | Height): number {
  if (typeof height === "bigint") {
    return Number(height);
  }
  return toIntHeight(height);
}

export function subtractBlock(height: Height, count = 1n): Height {
  return {
    revisionNumber: height.revisionNumber,
    revisionHeight: height.revisionHeight - count,
  };
}

const regexRevNum = new RegExp("-([1-9][0-9]*)$");

export function parseRevisionNumber(chainId: string): bigint {
  const match = chainId.match(regexRevNum);
  if (match && match.length >= 2) {
    return BigInt(match[1]);
  }
  return 0n;
}

// may will run the transform if value is defined, otherwise returns undefined
export function may<T, U>(
  transform: (val: T) => U,
  value: T | null | undefined,
): U | undefined {
  return value === undefined || value === null ? undefined : transform(value);
}

export function mapRpcPubKeyToProto(
  pubkey?: RpcPubKey,
): ProtoPubKey | undefined {
  if (pubkey === undefined) {
    return undefined;
  }
  if (pubkey.algorithm == "ed25519") {
    return {
      ed25519: pubkey.data,
      secp256k1: undefined,
    };
  } else if (pubkey.algorithm == "secp256k1") {
    return {
      ed25519: undefined,
      secp256k1: pubkey.data,
    };
  } else {
    throw new Error(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      `Unknown validator pubkey type: ${(pubkey as any).algorithm}`,
    );
  }
}

export function timestampFromDateNanos(
  date: ReadonlyDateWithNanoseconds,
): Timestamp {
  const nanos = (date.getTime() % 1000) * 1000000 + (date.nanoseconds ?? 0);
  return Timestamp.fromPartial({
    seconds: BigInt(Math.floor(date.getTime() / 1000)),
    nanos,
  });
}

export function secondsFromDateNanos(
  date: ReadonlyDateWithNanoseconds,
): number {
  return Math.floor(date.getTime() / 1000);
}

export function buildConsensusState(
  header: tendermint34.Header | tendermint37.Header,
): TendermintConsensusState {
  return TendermintConsensusState.fromPartial({
    timestamp: timestampFromDateNanos(header.time),
    root: {
      hash: header.appHash,
    },
    nextValidatorsHash: header.nextValidatorsHash,
  });
}

// Note: we hardcode a number of assumptions, like trust level, clock drift, and assume revisionNumber is 1
export function buildClientState(
  chainId: string,
  unbondingPeriodSec: number,
  trustPeriodSec: number,
  height: Height,
): TendermintClientState {
  // Copied here until https://github.com/confio/ics23/issues/36 is resolved
  // https://github.com/confio/ics23/blob/master/js/src/proofs.ts#L11-L26
  const iavlSpec = {
    leafSpec: {
      prefix: Uint8Array.from([0]),
      hash: HashOp.SHA256,
      prehashValue: HashOp.SHA256,
      prehashKey: HashOp.NO_HASH,
      length: LengthOp.VAR_PROTO,
    },
    innerSpec: {
      childOrder: [0, 1],
      minPrefixLength: 4,
      maxPrefixLength: 12,
      childSize: 33,
      hash: HashOp.SHA256,
    },
  };
  const tendermintSpec = {
    leafSpec: {
      prefix: Uint8Array.from([0]),
      hash: HashOp.SHA256,
      prehashValue: HashOp.SHA256,
      prehashKey: HashOp.NO_HASH,
      length: LengthOp.VAR_PROTO,
    },
    innerSpec: {
      childOrder: [0, 1],
      minPrefixLength: 1,
      maxPrefixLength: 1,
      childSize: 32,
      hash: HashOp.SHA256,
    },
  };

  return TendermintClientState.fromPartial({
    chainId,
    trustLevel: {
      numerator: 1n,
      denominator: 3n,
    },
    unbondingPeriod: {
      seconds: BigInt(unbondingPeriodSec),
    },
    trustingPeriod: {
      seconds: BigInt(trustPeriodSec),
    },
    maxClockDrift: {
      seconds: 20n,
    },
    latestHeight: height,
    proofSpecs: [iavlSpec, tendermintSpec],
    upgradePath: ["upgrade", "upgradedIBCState"],
    allowUpdateAfterExpiry: false,
    allowUpdateAfterMisbehaviour: false,
  });
}

export function parsePacketsFromBlockResult(
  result: tendermint34.BlockResultsResponse | tendermint37.BlockResultsResponse,
): Packet[] {
  return parsePacketsFromTendermintEvents([
    ...result.beginBlockEvents,
    ...result.endBlockEvents,
  ]);
}

/** Those events are normalized to strings already in CosmJS */
export function parsePacketsFromEvents(events: readonly Event[]): Packet[] {
  return events.filter(({ type }) => type === "send_packet").map(parsePacket);
}

/**
 * Takes a list of events, finds the send_packet events, stringifies attributes
 * and parsed the events into `Packet`s.
 */
export function parsePacketsFromTendermintEvents(
  events: readonly (tendermint34.Event | tendermint37.Event)[],
): Packet[] {
  return parsePacketsFromEvents(events.map(fromTendermintEvent));
}

export function parseHeightAttribute(attribute?: string): Height | undefined {
  // Note: With cosmjs-types>=0.9.0, I believe this no longer needs to return undefined under any circumstances
  // but will need more extensive testing before refactoring.

  const [timeoutRevisionNumber, timeoutRevisionHeight] =
    attribute?.split("-") ?? [];
  if (!timeoutRevisionHeight || !timeoutRevisionNumber) {
    return undefined;
  }

  const revisionNumber = BigInt(
    isNaN(Number(timeoutRevisionNumber)) ? 0 : timeoutRevisionNumber,
  );
  const revisionHeight = BigInt(
    isNaN(Number(timeoutRevisionHeight)) ? 0 : timeoutRevisionHeight,
  );
  // note: 0 revisionNumber is allowed. If there is bad data, '' or '0-0', we will get 0 for the height
  if (revisionHeight == 0n) {
    return undefined;
  }
  return { revisionHeight, revisionNumber };
}

export function parsePacket({ type, attributes }: Event): Packet {
  if (type !== "send_packet") {
    throw new Error(`Cannot parse event of type ${type}`);
  }
  const attributesObj: Record<string, string> = attributes.reduce(
    (acc, { key, value }) => ({
      ...acc,
      [key]: value,
    }),
    {},
  );

  return Packet.fromPartial({
    sequence: may(BigInt, attributesObj.packet_sequence),
    /** identifies the port on the sending chain. */
    sourcePort: attributesObj.packet_src_port,
    /** identifies the channel end on the sending chain. */
    sourceChannel: attributesObj.packet_src_channel,
    /** identifies the port on the receiving chain. */
    destinationPort: attributesObj.packet_dst_port,
    /** identifies the channel end on the receiving chain. */
    destinationChannel: attributesObj.packet_dst_channel,
    /** actual opaque bytes transferred directly to the application module */
    data: attributesObj.packet_data
      ? toUtf8(attributesObj.packet_data)
      : undefined,
    /** block height after which the packet times out */
    timeoutHeight: parseHeightAttribute(attributesObj.packet_timeout_height),
    /** block timestamp (in nanoseconds) after which the packet times out */
    timeoutTimestamp: may(BigInt, attributesObj.packet_timeout_timestamp),
  });
}

export function parseAcksFromTxEvents(events: readonly Event[]): Ack[] {
  return events
    .filter(({ type }) => type === "write_acknowledgement")
    .map(parseAck);
}

export function parseAck({ type, attributes }: Event): Ack {
  if (type !== "write_acknowledgement") {
    throw new Error(`Cannot parse event of type ${type}`);
  }
  const attributesObj: Record<string, string | undefined> = attributes.reduce(
    (acc, { key, value }) => ({
      ...acc,
      [key]: value,
    }),
    {},
  );
  const originalPacket = Packet.fromPartial({
    sequence: may(BigInt, attributesObj.packet_sequence),
    /** identifies the port on the sending chain. */
    sourcePort: attributesObj.packet_src_port,
    /** identifies the channel end on the sending chain. */
    sourceChannel: attributesObj.packet_src_channel,
    /** identifies the port on the receiving chain. */
    destinationPort: attributesObj.packet_dst_port,
    /** identifies the channel end on the receiving chain. */
    destinationChannel: attributesObj.packet_dst_channel,
    /** actual opaque bytes transferred directly to the application module */
    data: toUtf8(attributesObj.packet_data ?? ""),
    /** block height after which the packet times out */
    timeoutHeight: parseHeightAttribute(attributesObj.packet_timeout_height),
    /** block timestamp (in nanoseconds) after which the packet times out */
    timeoutTimestamp: may(BigInt, attributesObj.packet_timeout_timestamp),
  });
  const acknowledgement = toUtf8(attributesObj.packet_ack ?? "");
  return {
    acknowledgement,
    originalPacket,
  };
}

// return true if a > b, or a undefined
export function heightGreater(a: Height | undefined, b: Height): boolean {
  if (
    a === undefined ||
    (a.revisionHeight === BigInt(0) && a.revisionNumber === BigInt(0))
  ) {
    return true;
  }
  // comparing longs made some weird issues (maybe signed/unsigned)?
  // convert to numbers to compare safely
  const [numA, heightA, numB, heightB] = [
    Number(a.revisionNumber),
    Number(a.revisionHeight),
    Number(b.revisionNumber),
    Number(b.revisionHeight),
  ];
  const valid = numA > numB || (numA == numB && heightA > heightB);
  return valid;
}

// return true if a > b, or a 0
// note a is nanoseconds, while b is seconds
export function timeGreater(a: bigint | undefined, b: number): boolean {
  if (a === undefined || a == 0n) {
    return true;
  }
  const valid = Number(a) > b * 1_000_000_000;
  return valid;
}

// take height and time from receiving chain to see which packets have timed out
// return [toSubmit, toTimeout].
// you can advance height, time a block or two into the future if you wish a margin of error
export function splitPendingPackets(
  currentHeight: Height,
  currentTime: number, // in seconds
  packets: readonly PacketWithMetadata[],
): {
  readonly toSubmit: readonly PacketWithMetadata[];
  readonly toTimeout: readonly PacketWithMetadata[];
} {
  return packets.reduce(
    (acc, packet) => {
      const validPacket =
        heightGreater(packet.packet.timeoutHeight, currentHeight) &&
        timeGreater(packet.packet.timeoutTimestamp, currentTime);
      return validPacket
        ? {
            ...acc,
            toSubmit: [...acc.toSubmit, packet],
          }
        : {
            ...acc,
            toTimeout: [...acc.toTimeout, packet],
          };
    },
    {
      toSubmit: [] as readonly PacketWithMetadata[],
      toTimeout: [] as readonly PacketWithMetadata[],
    },
  );
}

export function presentPacketData(data: Uint8Array): Record<string, unknown> {
  try {
    return JSON.parse(fromUtf8(data));
  } catch {
    return { hex: toHex(data) };
  }
}
