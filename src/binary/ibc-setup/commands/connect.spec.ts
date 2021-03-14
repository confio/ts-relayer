import fs from 'fs';
import path from 'path';

import { assert } from '@cosmjs/utils';
import test from 'ava';
import sinon from 'sinon';
import { Logger } from 'winston';

import { setup, TestLogger } from '../../../lib/testutils';
import { appFile } from '../../constants';
import { generateMnemonic } from '../../utils/generate-mnemonic';

import { Options, run } from './connect';

const fsWriteFileSync = sinon.stub(fs, 'writeFileSync');
const fsReadFileSync = sinon.stub(fs, 'readFileSync');

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

const app = {
  src: 'local_wasm',
  dest: 'local_simapp',
};

test.beforeEach(() => {
  sinon.reset();
});

test('connects two chains', async (t) => {
  const logger = new TestLogger();

  const mnemonic = generateMnemonic();
  const [ibcClientSimapp, ibcClientWasm] = await setup(logger, mnemonic);

  // all connections are pretty meaningless when run in parallel, but we can assert they go up
  const allConnectionsWasm = await ibcClientWasm.query.ibc.connection.allConnections();
  const allConnectionsSimapp = await ibcClientSimapp.query.ibc.connection.allConnections();

  const options: Options = {
    home: '/home/user',
    mnemonic,
    src: 'local_simapp',
    dest: 'local_wasm',
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
  t.assert(logger.info.calledOnce);
  t.assert(logger.info.calledWithMatch(/Created connections/));

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

  t.assert(
    nextAllConnectionsWasm.connections.length >
      allConnectionsWasm.connections.length
  );
  t.assert(
    nextAllConnectionsSimapp.connections.length >
      allConnectionsSimapp.connections.length
  );
  t.assert(nextConnectionWasm.connection);
  t.assert(nextConnectionSimapp.connection);
});
