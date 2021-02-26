import fs from 'fs';

import test from 'ava';
import axios from 'axios';
import sinon from 'sinon';

import { Options, run } from './init';

const consoleLog = sinon.stub(console, 'log');
const fsExistSync = sinon.stub(fs, 'existsSync');
const fsMkdirSync = sinon.stub(fs, 'mkdirSync');
const axiosGet = sinon.stub(axios, 'get');
const fsReadFileSync = sinon.stub(fs, 'readFileSync');
const fsWriteFileSync = sinon.stub(fs, 'writeFileSync');

sinon.replace(
  fs,
  'lstatSync',
  sinon.fake.returns({
    isDirectory: () => true,
    isFile: () => true,
  })
);

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

test('create app.yaml', async (t) => {
  const options: Options = {
    home: '/home/user',
    src: 'local_wasm',
    dest: 'local_simapp',
  };
  const appPath = `${options.home}/app.yaml`;
  const registryPath = `${options.home}/registry.yaml`;

  fsExistSync
    .onCall(0)
    .returns(false)
    .onCall(1)
    .returns(true)
    .onCall(2)
    .returns(true);
  axiosGet.resolves({
    data: registryYaml,
  });
  fsReadFileSync.returns(registryYaml);
  fsWriteFileSync.returns();

  await run(options);

  t.assert(fsMkdirSync.notCalled);
  t.assert(axiosGet.notCalled);
  t.assert(fsReadFileSync.calledOnceWith(registryPath));

  const [path, contents] = fsWriteFileSync.getCall(0).args;
  const appYamlRegexp = new RegExp(
    `src: ${options.src}\ndest: ${options.dest}\nmnemonic: [\\w ]+`,
    'mg'
  );
  t.is(path, appPath);
  t.regex(contents as string, appYamlRegexp);

  t.assert(consoleLog.getCall(-2).calledWithMatch(/Source address: [\w ]+/));
  t.assert(
    consoleLog.getCall(-1).calledWithMatch(/Destination address: [\w ]+/)
  );
});

test('initialize home directory, pull registry.yaml and create app.yaml', async (t) => {
  const options: Options = {
    home: '/home/user',
    src: 'local_wasm',
    dest: 'local_simapp',
  };
  const appPath = `${options.home}/app.yaml`;
  const registryPath = `${options.home}/registry.yaml`;

  fsExistSync
    .onCall(0)
    .returns(false)
    .onCall(1)
    .returns(false)
    .onCall(2)
    .returns(false);
  fsMkdirSync.returns(options.home);
  axiosGet.resolves({
    data: registryYaml,
  });
  fsReadFileSync.returns(registryYaml);
  fsWriteFileSync.returns();

  await run(options);

  t.assert(fsMkdirSync.calledOnceWith(options.home));
  t.assert(axiosGet.calledOnce);
  t.assert(fsReadFileSync.calledOnceWith(registryPath));
  t.assert(fsWriteFileSync.calledWithExactly(registryPath, registryYaml));
  t.assert(consoleLog.calledWithMatch(new RegExp(`at ${options.home}`)));

  const [path, contents] = fsWriteFileSync.getCall(1).args;
  const appYamlRegexp = new RegExp(
    `src: ${options.src}\ndest: ${options.dest}\nmnemonic: [\\w ]+`,
    'mg'
  );
  t.is(path, appPath);
  t.regex(contents as string, appYamlRegexp);

  t.assert(consoleLog.getCall(-2).calledWithMatch(/Source address: [\w ]+/));
  t.assert(
    consoleLog.getCall(-1).calledWithMatch(/Destination address: [\w ]+/)
  );
});

test('throws when cannot fetch registry.yaml from remote', async (t) => {
  const options: Options = {
    home: '/home/user',
    src: 'local_wasm',
    dest: 'local_simapp',
  };

  fsExistSync.returns(false);
  fsMkdirSync.returns(options.home);
  axiosGet.rejects();
  fsReadFileSync.returns('');
  fsWriteFileSync.returns();

  await t.throwsAsync(async () => await run(options), {
    instanceOf: Error,
    message: /Cannot fetch registry.yaml/,
  });

  t.assert(fsMkdirSync.calledOnceWith(options.home));
  t.assert(axiosGet.calledOnce);
});

test('returns early if app.yaml exists', async (t) => {
  const options: Options = {
    home: '/home/user',
    src: 'local_wasm',
    dest: 'local_simapp',
  };

  fsExistSync.onCall(0).returns(true);

  await run(options);

  t.assert(fsExistSync.calledOnce);
  t.assert(consoleLog.calledWithMatch(/app.yaml is already initialized/));
  t.assert(consoleLog.calledOnce);
});

test('throws if provided chain does not exist in the registry', async (t) => {
  const options: Options = {
    home: '/home/user',
    src: 'chain_that_does_not_exist',
    dest: 'local_simapp',
  };
  const registryPath = `${options.home}/registry.yaml`;

  fsExistSync
    .onCall(0)
    .returns(false)
    .onCall(1)
    .returns(true)
    .onCall(2)
    .returns(true);
  axiosGet.resolves({
    data: registryYaml,
  });
  fsReadFileSync.returns(registryYaml);

  await t.throwsAsync(async () => await run(options), {
    instanceOf: Error,
    message: /chain_that_does_not_exist/,
  });

  t.assert(fsMkdirSync.notCalled);
  t.assert(axiosGet.notCalled);
  t.assert(fsReadFileSync.calledOnceWith(registryPath));
});
