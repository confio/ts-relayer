import {
  fromRfc3339WithNanoseconds,
  ReadonlyDateWithNanoseconds,
} from '@cosmjs/tendermint-rpc';
import test from 'ava';
import Long from 'long';

import {
  heightGreater,
  multiplyCoin,
  multiplyFees,
  parseHeightAttribute,
  parseRevisionNumber,
  secondsFromDateNanos,
  timeGreater,
  timestampFromDateNanos,
} from './utils';

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

test('properly multiplies coin', (t) => {
  const input = { amount: '1212', denom: 'foo' };
  const output = multiplyCoin(input, 3);
  t.deepEqual(output, { amount: '3636', denom: 'foo' });

  const input2 = { amount: '654321', denom: 'umuon' };
  const output2 = multiplyCoin(input2, 2);
  t.deepEqual(output2, { amount: '1308642', denom: 'umuon' });
});

test('properly multiplies fees', (t) => {
  const input = {
    gas: '12345',
    amount: [
      {
        amount: '654321',
        denom: 'umuon',
      },
    ],
  };
  const out = multiplyFees(input, 2);
  t.deepEqual(out.gas, '24690');
  t.deepEqual(out.amount, [{ amount: '1308642', denom: 'umuon' }]);
});

test('Properly determines height-based timeouts', (t) => {
  // proper heights
  t.deepEqual(parseHeightAttribute('1-34'), {
    revisionNumber: new Long(1),
    revisionHeight: new Long(34),
  });
  t.deepEqual(parseHeightAttribute('17-3456'), {
    revisionNumber: new Long(17),
    revisionHeight: new Long(3456),
  });

  // handles revision number 0 properly (this is allowed)
  t.deepEqual(parseHeightAttribute('0-1724'), {
    revisionNumber: new Long(0),
    revisionHeight: new Long(1724),
  });

  // missing heights
  t.is(parseHeightAttribute(''), undefined);
  t.is(parseHeightAttribute(), undefined);

  // bad format
  t.is(parseHeightAttribute('some-random-string'), undefined);

  // zero value is defined as missing
  t.is(parseHeightAttribute('0-0'), undefined);
});
