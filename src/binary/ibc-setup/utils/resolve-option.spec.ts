import test from 'ava';

import { resolveOption } from './resolve-option';

const stringOption1 = 'string option 1';
const stringOption2 = 'string option 2';
const functionWithString = () => 'function option';
// eslint-disable-next-line @typescript-eslint/no-empty-function
const functionWithVoid = () => {};

test('leftmost not undefined option takes precedence', (t) => {
  const option1 = resolveOption(
    'first option', // identifier
    undefined,
    undefined,
    stringOption1
  );
  t.is(option1, 'string option 1');

  const option2 = resolveOption(
    'second option',
    stringOption2,
    undefined,
    undefined
  );
  t.is(option2, 'string option 2');

  const option3 = resolveOption(
    'third option',
    stringOption2,
    stringOption1,
    stringOption1,
    stringOption1,
    undefined
  );
  t.is(option3, 'string option 2');
});

test('resolves function arguments', (t) => {
  const option1 = resolveOption(
    'first option',
    undefined,
    functionWithString,
    stringOption1
  );
  t.is(option1, 'function option');

  const option2 = resolveOption(
    'second option',
    functionWithString,
    undefined,
    undefined
  );
  t.is(option2, 'function option');

  const option3 = resolveOption(
    'third option',
    undefined,
    functionWithVoid,
    functionWithString,
    stringOption1,
    undefined
  );
  t.is(option3, 'function option');
});

test('throws if nothing is defined', (t) => {
  const option1 = () =>
    resolveOption(
      'first option',
      undefined,
      functionWithVoid,
      undefined,
      undefined,
      functionWithVoid
    );
  t.throws(option1, { instanceOf: Error });

  const option2 = () =>
    resolveOption('second option', undefined, undefined, undefined);
  t.throws(option2, { instanceOf: Error });

  const option3 = () =>
    resolveOption(
      'third option',
      functionWithVoid,
      functionWithVoid,
      functionWithVoid
    );
  t.throws(option3, { instanceOf: Error });
});
