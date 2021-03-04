import fs from 'fs';

import test from 'ava';
import sinon from 'sinon';

import { generateMnemonic } from '../utils/generate-mnemonic';

import { Options, run } from './keys-list';

const consoleLog = sinon.stub(console, 'log');
const fsReadFileSync = sinon.stub(fs, 'readFileSync');

test.beforeEach(() => {
  sinon.reset();
});

const registryYaml = `
version: 1

chains:
  musselnet:
    chain_id: musselnet-4
    # bech32 prefix for addresses
    prefix: wasm
    # this determines the gas payments we make (and defines the fee token)
    gas_price: 0.025umayo
    # the path we use to derive the private key from the mnemonic
    hd_path: m/44'/108'/0'/1'
    # you can include multiple RPC endpoints and it will rotate through them if
    # one is down
    rpc:
      - https://rpc.musselnet.cosmwasm.com:443
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
    gas_price: 0.025ucosm
    hd_path: m/44'/108'/0'/3'
    rpc:
      - http://localhost:26658`;

test('lists addresses for every chain in the registry', async (t) => {
  const options: Options = {
    home: '/home/user',
    mnemonic: generateMnemonic(),
  };

  fsReadFileSync.returns(registryYaml);

  await run(options);

  t.assert(fsReadFileSync.calledOnce);
  t.assert(consoleLog.calledOnce);
  t.assert(
    consoleLog.calledWithMatch(
      /musselnet: [a-z0-9]+\nlocal_wasm: [a-z0-9]+\nlocal_simapp: [a-z0-9]+/
    )
  );
});
