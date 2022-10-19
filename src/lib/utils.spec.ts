import { fromBase64, fromHex } from '@cosmjs/encoding';
import { logs } from '@cosmjs/stargate';
import {
  fromRfc3339WithNanoseconds,
  ReadonlyDateWithNanoseconds,
} from '@cosmjs/tendermint-rpc';
import test from 'ava';
import Long from 'long';

import {
  heightGreater,
  parseHeightAttribute,
  parsePacketsFromLogs,
  parseRevisionNumber,
  secondsFromDateNanos,
  stringifyEvent,
  timeGreater,
  timestampFromDateNanos,
} from './utils';

test('stringifyEvent works', (t) => {
  const event = stringifyEvent({
    type: 'coin_spent',
    attributes: [
      {
        key: fromBase64('c3BlbmRlcg=='),
        value: fromBase64(
          'anVubzEwMHM0NXM0aDk0cWRrY2FmbW1ycWZsdGxyZ3lxd3luNmUwNWp4Mg=='
        ),
      },
      {
        key: fromBase64('YW1vdW50'),
        value: fromBase64('MzY5NDV1anVub3g='),
      },
    ],
  });
  t.deepEqual(event, {
    type: 'coin_spent',
    attributes: [
      {
        key: 'spender',
        value: 'juno100s45s4h94qdkcafmmrqfltlrgyqwyn6e05jx2',
      },
      {
        key: 'amount',
        value: '36945ujunox',
      },
    ],
  });
});

test('parsePacketsFromLogs works for one packet', (t) => {
  // curl -sS "https://juno-testnet-rpc.polkachu.com/tx?hash=0x502E6F4AEA3FB185DD894D0DC14E013C45E6F52AC00A0B5224F6876A1CA107DB" | jq .result.tx_result.log -r
  // and then replace \" with \\" to get the correct JavaScript escaping
  const rawLog =
    '[{"events":[{"type":"execute","attributes":[{"key":"_contract_address","value":"juno19pam0vncl2s3etn4e7rqxvpq2gkyu9wg2czfvsph6dgvp00fsrxqzjt5sr"},{"key":"_contract_address","value":"juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9"}]},{"type":"message","attributes":[{"key":"action","value":"/cosmwasm.wasm.v1.MsgExecuteContract"},{"key":"module","value":"wasm"},{"key":"sender","value":"juno100s45s4h94qdkcafmmrqfltlrgyqwyn6e05jx2"}]},{"type":"send_packet","attributes":[{"key":"packet_channel_ordering","value":"ORDER_UNORDERED"},{"key":"packet_connection","value":"connection-31"},{"key":"packet_data","value":"{\\"after\\":\\"1666164035856871113\\",\\"sender\\":\\"juno19pam0vncl2s3etn4e7rqxvpq2gkyu9wg2czfvsph6dgvp00fsrxqzjt5sr\\",\\"job_id\\":\\"dapp-1-1666164017\\"}"},{"key":"packet_data_hex","value":"7b226166746572223a2231363636313634303335383536383731313133222c2273656e646572223a226a756e6f313970616d30766e636c32733365746e34653772717876707132676b797539776732637a66767370683664677670303066737278717a6a74357372222c226a6f625f6964223a22646170702d312d31363636313634303137227d"},{"key":"packet_dst_channel","value":"channel-10"},{"key":"packet_dst_port","value":"wasm.nois1j7m4f68lruceg5xq3gfkfdgdgz02vhvlq2p67vf9v3hwdydaat3sajzcy5"},{"key":"packet_sequence","value":"7489"},{"key":"packet_src_channel","value":"channel-42"},{"key":"packet_src_port","value":"wasm.juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9"},{"key":"packet_timeout_height","value":"0-0"},{"key":"packet_timeout_timestamp","value":"1666167632856871113"}]},{"type":"wasm","attributes":[{"key":"_contract_address","value":"juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9"},{"key":"action","value":"execute_get_next_randomness"}]}]}]';
  const parsedLog = logs.parseRawLog(rawLog);

  const packets = parsePacketsFromLogs(parsedLog);
  t.is(packets.length, 1);
  t.deepEqual(packets[0], {
    sequence: Long.fromNumber(7489),
    sourcePort:
      'wasm.juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9',
    sourceChannel: 'channel-42',
    destinationPort:
      'wasm.nois1j7m4f68lruceg5xq3gfkfdgdgz02vhvlq2p67vf9v3hwdydaat3sajzcy5',
    destinationChannel: 'channel-10',
    data: fromHex(
      '7b226166746572223a2231363636313634303335383536383731313133222c2273656e646572223a226a756e6f313970616d30766e636c32733365746e34653772717876707132676b797539776732637a66767370683664677670303066737278717a6a74357372222c226a6f625f6964223a22646170702d312d31363636313634303137227d'
    ),
    timeoutHeight: undefined,
    timeoutTimestamp: Long.fromString('1666167632856871113'),
  });
});

test('can parse revision numbers', (t) => {
  const musselnet = parseRevisionNumber('musselnet-4');
  t.is(musselnet.toNumber(), 4);

  const numerific = parseRevisionNumber('numers-123-456');
  t.is(numerific.toNumber(), 456);

  const nonums = parseRevisionNumber('hello');
  t.is(nonums.toNumber(), 0);

  const nonums2 = parseRevisionNumber('hello-world');
  t.is(nonums2.toNumber(), 0);
});

test('can parse strange revision numbers', (t) => {
  // all of these should give 0
  const strangers = [
    '',
    '-',
    'hello-',
    'hello-123-',
    'hello-0123',
    'hello-00123',
    'hello-1.23',
  ];
  for (const strange of strangers) {
    const rev = parseRevisionNumber(strange);
    t.is(rev.toNumber(), 0, strange);
  }
});

function nanosFromDateTime(time: ReadonlyDateWithNanoseconds): Long {
  const stamp = timestampFromDateNanos(time);
  return stamp.seconds.multiply(1_000_000_000).add(stamp.nanos);
}

test('time-based timeouts properly', (t) => {
  const time1 = fromRfc3339WithNanoseconds('2021-03-12T12:34:56.123456789Z');
  const time2 = fromRfc3339WithNanoseconds('2021-03-12T12:36:56.543543543Z');
  const time3 = fromRfc3339WithNanoseconds('2021-03-12T12:36:13Z');

  const sec1 = secondsFromDateNanos(time1);
  const nanos1 = nanosFromDateTime(time1);
  const sec2 = secondsFromDateNanos(time2);
  const nanos2 = nanosFromDateTime(time2);

  const greaterThanNull = timeGreater(undefined, secondsFromDateNanos(time1));
  t.is(greaterThanNull, true);

  const greaterThanPast = timeGreater(nanos2, sec1);
  t.is(greaterThanPast, true);
  const greaterThanFuture = timeGreater(nanos1, sec2);
  t.is(greaterThanFuture, false);

  // nanos seconds beat seconds if present
  const greaterThanSelfWithNanos = timeGreater(nanos1, sec1);
  t.is(greaterThanSelfWithNanos, true);
  const greaterThanSelf = timeGreater(
    nanosFromDateTime(time3),
    secondsFromDateNanos(time3)
  );
  t.is(greaterThanSelf, false);
});

test('height based timeouts properly', (t) => {
  const height1a = {
    revisionHeight: Long.fromNumber(12345),
    revisionNumber: Long.fromNumber(1),
  };
  const height1b = {
    revisionHeight: Long.fromNumber(14000),
    revisionNumber: Long.fromNumber(1),
  };
  const height2a = {
    revisionHeight: Long.fromNumber(600),
    revisionNumber: Long.fromNumber(2),
  };

  t.assert(heightGreater(height1b, height1a));
  t.assert(heightGreater(height2a, height1b));
  t.assert(heightGreater(undefined, height2a));

  t.false(heightGreater(height1b, height1b));
  t.false(heightGreater(height1a, height1b));
});

test('Properly determines height-based timeouts', (t) => {
  // proper heights
  t.deepEqual(parseHeightAttribute('1-34'), {
    revisionNumber: Long.fromNumber(1),
    revisionHeight: Long.fromNumber(34),
  });
  t.deepEqual(parseHeightAttribute('17-3456'), {
    revisionNumber: Long.fromNumber(17),
    revisionHeight: Long.fromNumber(3456),
  });

  // handles revision number 0 properly (this is allowed)
  t.deepEqual(parseHeightAttribute('0-1724'), {
    revisionNumber: Long.fromNumber(0),
    revisionHeight: Long.fromNumber(1724),
  });

  // missing heights
  t.is(parseHeightAttribute(''), undefined);
  t.is(parseHeightAttribute(), undefined);

  // bad format
  t.is(parseHeightAttribute('some-random-string'), undefined);

  // zero value is defined as missing
  t.is(parseHeightAttribute('0-0'), undefined);
});
