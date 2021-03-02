import test from 'ava';

import { resolveOption } from './resolve-option';

const stringOption1 = 'string option 1';
const stringOption2 = 'string option 2';
const functionWithString = () => 'function option';
const functionWithNull = () => {
  return null;
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
    functionWithNull,
    functionWithString,
    stringOption1,
    undefined
  );
  t.is(option3, 'function option');
});

test('returns null for undefined/null options', (t) => {
  const option1 = resolveOption(
    undefined,
    functionWithNull,
    null,
    undefined,
    functionWithNull
  );
  t.is(option1, null);

  const option2 = resolveOption(undefined, null, undefined);
  t.is(option2, null);

  const option3 = resolveOption(
    functionWithNull,
    functionWithNull,
    functionWithNull
  );
  t.is(option3, null);
});
