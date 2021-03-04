import fs from 'fs';

import test from 'ava';
import sinon from 'sinon';

// import { Options, run } from './ics20';

const fsReadFileSync = sinon.stub(fs, 'readFileSync');

// const defaultMnemonic =
//   'enlist hip relief stomach skate base shallow young switch frequent cry park';

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

test.beforeEach(() => {
  sinon.reset();
});

test.only('ics20 create channels with new connection', async (t) => {
  // const options: Options = {
  //   home: '/home/user',
  //   mnemonic: defaultMnemonic,
  //   src: 'local_wasm',
  //   dest: 'local_simapp',
  //   srcPort: 'transfer',
  //   destPort: 'custom',
  // };

  fsReadFileSync.returns(registryYaml);

  // await run(options, app);
  t.assert(false);
});
