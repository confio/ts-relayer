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

test('create app.yaml', async (t) => {
  const options: Options = {
    home: '/home/user',
    src: 'AAA',
    dest: 'BBB',
  };
  const appPath = `${options.home}/app.yaml`;
  const registryPath = `${options.home}/registry.yaml`;
  const registryYaml = `
  version: 1
  `;

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
});

test('initialize home directory, pull registry.yaml and create app.yaml', async (t) => {
  const options: Options = {
    home: '/home/user',
    src: 'AAA',
    dest: 'BBB',
  };
  const appPath = `${options.home}/app.yaml`;
  const registryPath = `${options.home}/registry.yaml`;
  const registryYaml = `
  version: 1
  `;

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
