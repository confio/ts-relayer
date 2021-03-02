import test from 'ava';

import { resolveRequiredOption } from './resolve-required-option';

test('uses resolveOption func', (t) => {
  const option = resolveRequiredOption('some option')(
    undefined,
    null,
    'some string',
    'another string'
  );
  t.is(option, 'some string');
});

test('throws if all options are undefined or null', (t) => {
  const option = () =>
    resolveRequiredOption('some option')(undefined, null, undefined);
  t.throws(option, { instanceOf: Error, message: /some option/ });
});
