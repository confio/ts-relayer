import fs from 'fs';

import test from 'ava';
import sinon from 'sinon';
import { Logger } from 'winston';

import { TestLogger } from '../../../lib/testutils';
import { generateMnemonic } from '../../utils/generate-mnemonic';

import { Options, run } from './keys-list';

const fsReadFileSync = sinon.stub(fs, 'readFileSync');

test.beforeEach(() => {
  sinon.reset();
});

const registryYaml = `
version: 1

chains:
  local_wasm:
    chain_id: testing
    prefix: wasm
    gas_price: 0.025ucosm
    hd_path: m/44'/108'/0'/2'
    rpc:
      - http://localhost:26659
  local_simapp:
    chain_id: simd-testing
    prefix: cosmos
    gas_price: 0.025umuon
    hd_path: m/44'/108'/0'/3'
    rpc:
      - http://localhost:26658`;

test('lists addresses for every chain in the registry', async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    home: '/home/user',
    mnemonic: generateMnemonic(),
  };

  fsReadFileSync.returns(registryYaml);

  await run(options, (logger as unknown) as Logger);

  t.assert(fsReadFileSync.calledOnce);
  t.assert(logger.info.calledOnce);
  t.assert(
    logger.info.calledWithMatch(
      /local_wasm: [a-z0-9]+\nlocal_simapp: [a-z0-9]+/
    )
  );
});
