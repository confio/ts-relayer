import test from 'ava';

import { resolveRequiredOption } from './resolve-required-option';

test('uses resolveOption func', (t) => {
  const option = resolveRequiredOption('some option')(
    undefined,
    undefined,
    'some string',
    'another string'
  );
  t.is(option, 'some string');
});

test('throws if all options are undefined', (t) => {
  const option = () =>
    resolveRequiredOption('some option')(undefined, undefined, undefined);
  t.throws(option, { instanceOf: Error, message: /some option/ });
});
