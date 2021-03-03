import fs from 'fs';
import os from 'os';

import test from 'ava';
import sinon from 'sinon';

import { IbcClient } from '../../../lib/ibcclient';
import { generateMnemonic } from '../utils/generate-mnemonic';

import { Options, run } from './balances';

const consoleLog = sinon.stub(console, 'log');
const fsReadFileSync = sinon.stub(fs, 'readFileSync');
const ibcClient = sinon.stub(IbcClient, 'connectWithSigner');
const mnemonic = generateMnemonic();

function fakeBalance(amount: string) {
  return (Promise.resolve({
    query: {
      bank: {
        unverified: {
          balance: sinon.fake.returns({ amount, denom: 'sampledenom' }),
        },
      },
    },
  }) as unknown) as Promise<IbcClient>;
}

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

test('lists chains with non-zero balance', async (t) => {
  const options: Options = {
    home: '/home/user',
    mnemonic,
  };

  fsReadFileSync.returns(registryYaml);
  ibcClient
    .onCall(0)
    .returns(fakeBalance('1'))
    .onCall(1)
    .returns(fakeBalance('2'))
    .onCall(2)
    .returns(fakeBalance('3'));

  await run(options);

  t.assert(fsReadFileSync);
  t.assert(consoleLog.calledOnce);
  t.assert(
    consoleLog.calledWithExactly(
      ['musselnet: 1', 'local_wasm: 2', 'local_simapp: 3'].join(os.EOL)
    )
  );
});

test('omits chains with zero balance', async (t) => {
  const options: Options = {
    home: '/home/user',
    mnemonic,
  };

  fsReadFileSync.returns(registryYaml);
  ibcClient
    .onCall(0)
    .returns(fakeBalance('1'))
    .onCall(1)
    .returns(fakeBalance('0'))
    .onCall(2)
    .returns(fakeBalance('3'));

  await run(options);

  t.assert(fsReadFileSync);
  t.assert(consoleLog.calledOnce);
  t.assert(
    consoleLog.calledWithExactly(
      ['musselnet: 1', 'local_simapp: 3'].join(os.EOL)
    )
  );
});

test('informs when there are no funds on any balance', async (t) => {
  const options: Options = {
    home: '/home/user',
    mnemonic,
  };

  fsReadFileSync.returns(registryYaml);
  ibcClient
    .onCall(0)
    .returns(fakeBalance('0'))
    .onCall(1)
    .returns(fakeBalance('0'))
    .onCall(2)
    .returns(fakeBalance('0'));

  await run(options);

  t.assert(fsReadFileSync);
  t.assert(consoleLog.calledOnce);
  t.assert(consoleLog.calledWithMatch(/No funds/));
});
