import { toUtf8 } from '@cosmjs/encoding';
import { BroadcastTxFailure } from '@cosmjs/stargate';
import {
  ReadonlyDateWithNanoseconds,
  Header as RpcHeader,
  ValidatorPubkey as RpcPubKey,
} from '@cosmjs/tendermint-rpc';
import Long from 'long';

import { HashOp, LengthOp } from '../codec/confio/proofs';
import { Timestamp } from '../codec/google/protobuf/timestamp';
import { Packet } from '../codec/ibc/core/channel/v1/channel';
import { Height } from '../codec/ibc/core/client/v1/client';
import {
  ClientState as TendermintClientState,
  ConsensusState as TendermintConsensusState,
} from '../codec/ibc/lightclients/tendermint/v1/tendermint';
import { PublicKey as ProtoPubKey } from '../codec/tendermint/crypto/keys';

export function createBroadcastTxErrorMessage(
  result: BroadcastTxFailure
): string {
  return `Error when broadcasting tx ${result.transactionHash} at height ${result.height}. Code: ${result.code}; Raw log: ${result.rawLog}`;
}

export function toIntHeight(height?: Height): number {
  return height?.revisionHeight?.toNumber() ?? 0;
}

export function toProtoHeight(height: number): Height {
  return Height.fromPartial({
    revisionHeight: new Long(height),
  });
}

export function mapRpcPubKeyToProto(
  pubkey?: RpcPubKey
): ProtoPubKey | undefined {
  if (pubkey === undefined) {
    return undefined;
  }
  if (pubkey.algorithm == 'ed25519') {
    return {
      ed25519: pubkey.data,
      secp256k1: undefined,
    };
  } else if (pubkey.algorithm == 'secp256k1') {
    return {
      ed25519: undefined,
      secp256k1: pubkey.data,
    };
  } else {
    throw new Error(`Unknown validator pubkey type: ${pubkey.algorithm}`);
  }
}

export function timestampFromDateNanos(
  date: ReadonlyDateWithNanoseconds
): Timestamp {
  const nanos = (date.getTime() % 1000) * 1000000 + (date.nanoseconds ?? 0);
  return Timestamp.fromPartial({
    seconds: new Long(date.getTime() / 1000),
    nanos,
  });
}

export function buildConsensusState(
  header: RpcHeader
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
  height: number
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
      numerator: Long.fromInt(1),
      denominator: Long.fromInt(3),
    },
    unbondingPeriod: {
      seconds: new Long(unbondingPeriodSec),
    },
    trustingPeriod: {
      seconds: new Long(trustPeriodSec),
    },
    maxClockDrift: {
      seconds: new Long(20),
    },
    latestHeight: {
      revisionNumber: new Long(0), // ??
      revisionHeight: new Long(height),
    },
    proofSpecs: [iavlSpec, tendermintSpec],
    upgradePath: ['upgrade', 'upgradedIBCState'],
    allowUpdateAfterExpiry: false,
    allowUpdateAfterMisbehaviour: false,
  });
}

interface ParsedAttribute {
  readonly key: string;
  readonly value: string;
}

interface ParsedEvent {
  readonly type: string;
  readonly attributes: readonly ParsedAttribute[];
}

export function parsePacket({ type, attributes }: ParsedEvent): Packet {
  if (type !== 'send_packet') {
    throw new Error(`Cannot parse event of type ${type}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attributesObj: any = attributes.reduce(
    (acc, { key, value }) => ({
      ...acc,
      [key]: value,
    }),
    {}
  );
  const [timeoutRevisionNumber, timeoutRevisionHeight] =
    attributesObj.packet_timeout_height?.split('-') ?? [];
  return {
    sequence: Long.fromNumber(attributesObj.packet_sequence ?? 0, true),
    /** identifies the port on the sending chain. */
    sourcePort: attributesObj.packet_src_port ?? '',
    /** identifies the channel end on the sending chain. */
    sourceChannel: attributesObj.packet_src_channel ?? '',
    /** identifies the port on the receiving chain. */
    destinationPort: attributesObj.packet_dst_port ?? '',
    /** identifies the channel end on the receiving chain. */
    destinationChannel: attributesObj.packet_dst_channel ?? '',
    /** actual opaque bytes transferred directly to the application module */
    data: toUtf8(attributesObj.packet_data ?? ''),
    /** block height after which the packet times out */
    timeoutHeight:
      timeoutRevisionNumber && timeoutRevisionHeight
        ? Height.fromPartial({
            revisionNumber: timeoutRevisionNumber,
            revisionHeight: timeoutRevisionHeight,
          })
        : undefined,
    /** block timestamp (in nanoseconds) after which the packet times out */
    timeoutTimestamp: Long.fromString(
      attributesObj.packet_timeout_timestamp ?? '0',
      true
    ),
  };
}
