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

test.beforeEach(() => {
  sinon.reset();
});

test('read existing registry.yaml', async (t) => {
  const options: Options = {
    home: '/home/user',
    src: 'AAA',
    dest: 'BBB',
  };
  const registryPath = `${options.home}/registry.yaml`;
  const registryYaml = `
  version: 1
  `;

  fsExistSync.onCall(0).returns(true).onCall(1).returns(true);
  axiosGet.resolves({
    data: registryYaml,
  });
  fsReadFileSync.returns(registryYaml);
  fsWriteFileSync.returns();

  await run(options);

  t.assert(fsMkdirSync.notCalled);
  t.assert(axiosGet.notCalled);
  t.assert(fsReadFileSync.calledOnceWith(registryPath));
  t.assert(fsWriteFileSync.notCalled);
  t.assert(consoleLog.calledWith({ version: 1 }));
});

test('initialize home directory and pull registry.yaml from remote', async (t) => {
  const options: Options = {
    home: '/home/user',
    src: 'AAA',
    dest: 'BBB',
  };
  const registryPath = `${options.home}/registry.yaml`;
  const registryYaml = `
  version: 1
  `;

  fsExistSync.onCall(0).returns(false).onCall(1).returns(false);
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
  t.assert(fsWriteFileSync.calledOnceWith(registryPath, registryYaml));
  t.assert(consoleLog.calledWithMatch(new RegExp(`at ${options.home}`)));
  t.assert(consoleLog.calledWith({ version: 1 }));
});

test('throws when cannot fetch registry.yaml from remote', async (t) => {
  const options: Options = {
    home: '/home/user',
    src: 'AAA',
    dest: 'BBB',
  };

  fsExistSync.onCall(0).returns(false).onCall(1).returns(false);
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
