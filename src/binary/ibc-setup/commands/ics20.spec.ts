import fs from 'fs';
import path from 'path';

import test from 'ava';
import sinon from 'sinon';

import { appFile } from '../../constants';

import { Options, run } from './ics20';

const fsWriteFileSync = sinon.stub(fs, 'writeFileSync');
const fsReadFileSync = sinon.stub(fs, 'readFileSync');
const consoleLog = sinon.stub(console, 'log');

const mnemonic =
  'enlist hip relief stomach skate base shallow young switch frequent cry park';

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

const app = {
  src: 'local_wasm',
  dest: 'local_simapp',
};

test.beforeEach(() => {
  sinon.reset();
});

test.only('ics20 create channels with new connection', async (t) => {
  const options: Options = {
    home: '/home/user',
    mnemonic,
    src: 'local_wasm',
    dest: 'local_simapp',
    srcPort: 'transfer',
    destPort: 'custom',
  };

  fsReadFileSync.returns(registryYaml);
  fsWriteFileSync.returns();

  await run(options, app);

  const contentsRegexp = new RegExp(
    `src: local_wasm
dest: local_simapp
srcClient: .+
destClient: .+
srcConnection: .+
destConnection: .+
`
  );

  const args = fsWriteFileSync.getCall(0).args as [string, string];
  t.assert(fsWriteFileSync.calledOnce);
  t.is(args[0], path.join(options.home, appFile));
  t.regex(args[1], contentsRegexp);
  t.assert(consoleLog.calledOnce);
  t.assert(consoleLog.calledWithMatch(/Created channels/));
});
