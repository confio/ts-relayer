import test from 'ava';

import { resolveOption } from './resolve-option';

const stringOption1 = 'string option 1';
const stringOption2 = 'string option 2';
const functionWithString = () => 'function option';
const functionWithUndefined = () => {
  return undefined;
};

test('leftmost defined option takes precedence', (t) => {
  const option1 = resolveOption(undefined, undefined, stringOption1);
  t.is(option1, stringOption1);

  const option2 = resolveOption(stringOption2, undefined, undefined);
  t.is(option2, stringOption2);

  const option3 = resolveOption(
    stringOption2,
    stringOption1,
    stringOption1,
    stringOption1,
    undefined
  );
  t.is(option3, stringOption2);
});

test('resolves function arguments', (t) => {
  const option1 = resolveOption(undefined, functionWithString, stringOption1);
  t.is(option1, 'function option');

  const option2 = resolveOption(functionWithString, undefined, undefined);
  t.is(option2, 'function option');

  const option3 = resolveOption(
    undefined,
    functionWithUndefined,
    functionWithString,
    stringOption1,
    undefined
  );
  t.is(option3, 'function option');
});

test('returns undefined for undefined options', (t) => {
  const option1 = () =>
    resolveOption(
      undefined,
      functionWithUndefined,
      undefined,
      undefined,
      functionWithUndefined
    );
  t.is(option1, undefined);

  const option2 = () =>
    resolveOption('second option', undefined, undefined, undefined);
  t.is(option2, undefined);

  const option3 = () =>
    resolveOption(
      functionWithUndefined,
      functionWithUndefined,
      functionWithUndefined
    );
  t.is(option3, undefined);
});
