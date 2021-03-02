import test from 'ava';

import { parseRevisionNumber } from './utils';

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
