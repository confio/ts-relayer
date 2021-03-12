import fs from 'fs';

import test from 'ava';
import sinon from 'sinon';

import { Options, run } from './keys-generate';
import { TestLogger } from '../../../lib/testutils';
import { Logger } from 'winston';

const fsWriteFileSync = sinon.stub(fs, 'writeFileSync');

test.beforeEach(() => {
  sinon.reset();

  fsWriteFileSync.returns();
});

test('generates mnemonic to stdout', (t) => {
  const logger = new TestLogger();

  const options: Options = {
    keyFile: null,
  };

  run(options, (logger as unknown) as Logger);

  t.assert(logger.info.calledOnce);
  t.assert(logger.info.calledWithMatch(/[\\w ]+/));
  t.assert(fsWriteFileSync.notCalled);
});

test('generates mnemonic to file', (t) => {
  const logger = new TestLogger();

  const options: Options = {
    keyFile: '/home/user/mnemonic.txt',
  };

  run(options, (logger as unknown) as Logger);

  const [path, contents] = fsWriteFileSync.getCall(0).args;
  t.is(path, options.keyFile);
  t.regex(contents as string, /[\\w ]+/);

  t.assert(logger.info.calledOnce);
  t.assert(logger.info.calledWithMatch(/Saved mnemonic to/));
});
