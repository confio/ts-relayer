import fs from 'fs';
import path from 'path';

import { assert } from '@cosmjs/utils';
import test from 'ava';
import sinon from 'sinon';

import { TestLogger } from '../../../lib/testutils';
import { appFile } from '../../constants';
import { Logger } from '../../create-logger';
import { signingClient } from '../../utils/signing-client';

import { simappChain, wasmdChain } from './chains';
import { Options, run } from './connect';

const fsWriteFileSync = sinon.stub(fs, 'writeFileSync');
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

const registryYamlTooLowGas = `
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
    gas_limits:
      # this will fail
      init_connection: 40000
    rpc:
      - http://localhost:26658`;

const registryYamlHigherGas = `
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
    gas_limits:
      # this will succeed
      init_connection: 808000
    rpc:
      - http://localhost:26658`;

const app = {
  src: 'local_wasm',
  dest: 'local_simapp',
};

test.beforeEach(() => {
  sinon.reset();
});

test.serial('connects two chains', async (t) => {
  const logger = new TestLogger();

  const ibcClientSimapp = await signingClient(simappChain, mnemonic);
  const ibcClientWasm = await signingClient(wasmdChain, mnemonic);

  const allConnectionsWasm = await ibcClientWasm.query.ibc.connection.allConnections();
  const allConnectionsSimapp = await ibcClientSimapp.query.ibc.connection.allConnections();

  const options: Options = {
    home: '/home/user',
    mnemonic,
    src: 'local_simapp',
    dest: 'local_wasm',
    srcTrust: null,
    destTrust: null,
  };

  fsReadFileSync.returns(registryYaml);
  fsWriteFileSync.returns();

  await run(options, app, (logger as unknown) as Logger);

  const args = fsWriteFileSync.getCall(0).args as [string, string];
  const contentsRegexp = new RegExp(
    `src: local_wasm
dest: local_simapp
srcConnection: .+
destConnection: .+
`
  );
  t.assert(fsWriteFileSync.calledOnce);
  t.is(args[0], path.join(options.home, appFile));
  t.regex(args[1], contentsRegexp);
  t.assert(consoleLog.calledOnce);
  t.assert(consoleLog.calledWithMatch(/Created connections/));

  const nextAllConnectionsWasm = await ibcClientWasm.query.ibc.connection.allConnections();
  const destConnectionIdMatch = /destConnection: (?<connection>.+)/.exec(
    args[1]
  );
  const destConnectionId = destConnectionIdMatch?.groups?.connection;
  assert(destConnectionId);
  const nextConnectionWasm = await ibcClientWasm.query.ibc.connection.connection(
    destConnectionId
  );

  const nextAllConnectionsSimapp = await ibcClientSimapp.query.ibc.connection.allConnections();
  const srcConnectionIdMatch = /srcConnection: (?<connection>.+)/.exec(args[1]);
  const srcConnectionId = srcConnectionIdMatch?.groups?.connection;
  assert(srcConnectionId);
  const nextConnectionSimapp = await ibcClientSimapp.query.ibc.connection.connection(
    srcConnectionId
  );

  t.is(
    nextAllConnectionsWasm.connections.length,
    allConnectionsWasm.connections.length + 1
  );
  t.is(
    nextAllConnectionsSimapp.connections.length,
    allConnectionsSimapp.connections.length + 1
  );
  t.assert(nextConnectionWasm.connection);
  t.assert(nextConnectionSimapp.connection);
});

test.serial('connects two chains fails with too low gas', async (t) => {
  const logger = new TestLogger();

  const ibcClientSimapp = await signingClient(simappChain, mnemonic);
  const ibcClientWasm = await signingClient(wasmdChain, mnemonic);

  const allConnectionsWasm = await ibcClientWasm.query.ibc.connection.allConnections();
  const allConnectionsSimapp = await ibcClientSimapp.query.ibc.connection.allConnections();

  const options: Options = {
    home: '/home/user',
    mnemonic,
    src: 'local_simapp',
    dest: 'local_wasm',
    srcTrust: null,
    destTrust: null,
  };

  fsReadFileSync.returns(registryYamlTooLowGas);
  fsWriteFileSync.returns();

  // this should throw an error when trying to set up the connection
  await t.throwsAsync(() => run(options, app, (logger as unknown) as Logger));

  const nextAllConnectionsWasm = await ibcClientWasm.query.ibc.connection.allConnections();
  const nextAllConnectionsSimapp = await ibcClientSimapp.query.ibc.connection.allConnections();
  // no connection can be made
  t.is(
    nextAllConnectionsWasm.connections.length,
    allConnectionsWasm.connections.length
  );
  t.is(
    nextAllConnectionsSimapp.connections.length,
    allConnectionsSimapp.connections.length
  );
});

test.serial('connects two chains with explicit high gas works', async (t) => {
  const logger = new TestLogger();

  const ibcClientSimapp = await signingClient(simappChain, mnemonic);
  const ibcClientWasm = await signingClient(wasmdChain, mnemonic);

  const allConnectionsWasm = await ibcClientWasm.query.ibc.connection.allConnections();
  const allConnectionsSimapp = await ibcClientSimapp.query.ibc.connection.allConnections();

  const options: Options = {
    home: '/home/user',
    mnemonic,
    src: 'local_simapp',
    dest: 'local_wasm',
    srcTrust: null,
    destTrust: null,
  };

  fsReadFileSync.returns(registryYamlHigherGas);
  fsWriteFileSync.returns();

  // this will NOT fail
  await run(options, app, (logger as unknown) as Logger);

  const nextAllConnectionsWasm = await ibcClientWasm.query.ibc.connection.allConnections();
  const nextAllConnectionsSimapp = await ibcClientSimapp.query.ibc.connection.allConnections();
  // one connection is made
  t.is(
    nextAllConnectionsWasm.connections.length,
    allConnectionsWasm.connections.length + 1
  );
  t.is(
    nextAllConnectionsSimapp.connections.length,
    allConnectionsSimapp.connections.length + 1
  );
});
