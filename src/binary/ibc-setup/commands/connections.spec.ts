import fs from 'fs';

import test from 'ava';
import sinon from 'sinon';

import { Link } from '../../../lib/link';
import { TestLogger } from '../../../lib/testutils';
import { Logger } from '../../create-logger';
import { signingClient } from '../../utils/signing-client';

import { simappChain, wasmdChain } from './chains';
import { Options, run } from './connections';

const fsReadFileSync = sinon.stub(fs, 'readFileSync');
const consoleLog = sinon.stub(console, 'log');

const mnemonic =
  'enlist hip relief stomach skate base shallow young switch frequent cry park';

const registryYaml = `
version: 1

chains:
  local_wasm:
    chain_id: testing
    prefix: wasm
    gas_price: 0.025ucosm
    rpc:
      - http://localhost:26659
  local_simapp:
    chain_id: simd-testing
    prefix: cosmos
    gas_price: 0.025umuon
    rpc:
      - http://localhost:26658`;

test.beforeEach(() => {
  sinon.reset();
});

test.serial('lists connections', async (t) => {
  const logger = new TestLogger();

  const ibcClientSimapp = await signingClient(simappChain, mnemonic);
  const ibcClientWasm = await signingClient(wasmdChain, mnemonic);

  const link = await Link.createWithNewConnections(
    ibcClientSimapp,
    ibcClientWasm
  );

  const options: Options = {
    home: '/home/user',
    mnemonic,
    chain: 'local_simapp',
  };

  fsReadFileSync.returns(registryYaml);

  await run(options, (logger as unknown) as Logger);

  const tableRow = [link.endA.connectionID, link.endA.clientID, 0, 'Open'];
  const match = new RegExp(tableRow.join('\\s+'));
  t.assert(consoleLog.getCall(-1).calledWithMatch(match));
});

// TODO: #130
// test.serial('logs a message when no connections are found', async (t) => {
//   //
// });
