import fs from 'fs';
import os from 'os';

import test from 'ava';
import sinon from 'sinon';
import { Logger } from 'winston';

import { IbcClient } from '../../../lib/ibcclient';
import { TestLogger } from '../../../lib/testutils';

import { run } from './balances';
import { Options } from './keys-list';

const fsReadFileSync = sinon.stub(fs, 'readFileSync');
const mnemonic =
  'accident harvest weasel surge source return tag supreme sorry isolate wave mammal';

function buildIbcArgs(rpc: string) {
  return [rpc, sinon.match.any, sinon.match.any, sinon.match.any] as const;
}
const ibcClient = sinon.stub(IbcClient, 'connectWithSigner');
const musselnetArgs = buildIbcArgs('https://rpc.musselnet.cosmwasm.com:443');
const localWasmArgs = buildIbcArgs('http://localhost:26659');
const localSimappArgs = buildIbcArgs('http://localhost:26658');

async function createFakeIbcClient(amount: string, denom: string) {
  return ({
    query: {
      bank: {
        unverified: {
          balance: sinon.fake.returns({ amount, denom }),
        },
      },
    },
  } as unknown) as IbcClient;
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
    gas_price: 0.025umuon
    hd_path: m/44'/108'/0'/3'
    rpc:
      - http://localhost:26658`;

test('lists chains with non-zero balance', async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    home: '/home/user',
    mnemonic,
  };

  fsReadFileSync.returns(registryYaml);
  ibcClient
    .withArgs(...musselnetArgs)
    .returns(createFakeIbcClient('1', 'musselnetdenom'))
    .withArgs(...localWasmArgs)
    .returns(createFakeIbcClient('2', 'wasmdenom'))
    .withArgs(...localSimappArgs)
    .returns(createFakeIbcClient('3', 'simappdenom'));

  await run(options, (logger as unknown) as Logger);

  t.assert(fsReadFileSync.calledOnce);
  t.assert(logger.info.calledOnce);
  t.assert(
    logger.info.calledWithExactly(
      [
        'musselnet: 1musselnetdenom',
        'local_wasm: 2wasmdenom',
        'local_simapp: 3simappdenom',
      ].join(os.EOL)
    )
  );
});

test('omits chains with zero balance', async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    home: '/home/user',
    mnemonic,
  };

  fsReadFileSync.returns(registryYaml);
  ibcClient
    .withArgs(...musselnetArgs)
    .returns(createFakeIbcClient('1', 'musselnetdenom'))
    .withArgs(...localWasmArgs)
    .returns(createFakeIbcClient('0', 'wasmdenom'))
    .withArgs(...localSimappArgs)
    .returns(createFakeIbcClient('3', 'simappdenom'));

  await run(options, (logger as unknown) as Logger);

  t.assert(fsReadFileSync.calledOnce);
  t.assert(logger.info.calledOnce);
  t.assert(
    logger.info.calledWithExactly(
      ['musselnet: 1musselnetdenom', 'local_simapp: 3simappdenom'].join(os.EOL)
    )
  );
});

test('informs when there are no funds on any balance', async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    home: '/home/user',
    mnemonic,
  };

  fsReadFileSync.returns(registryYaml);
  ibcClient
    .withArgs(...musselnetArgs)
    .returns(createFakeIbcClient('0', 'musselnetdenom'))
    .withArgs(...localWasmArgs)
    .returns(createFakeIbcClient('0', 'wasmdenom'))
    .withArgs(...localSimappArgs)
    .returns(createFakeIbcClient('0', 'simappdenom'));

  await run(options, (logger as unknown) as Logger);

  t.assert(fsReadFileSync.calledOnce);
  t.assert(logger.info.calledOnce);
  t.assert(logger.info.calledWithMatch(/No funds/));
});
