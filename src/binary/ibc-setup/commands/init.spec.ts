import fs from "fs";
import path from "path";

import test from "ava";
import axios from "axios";
import sinon from "sinon";

import { registryFile } from "../../constants";

import { Options, run } from "./init";

const fsExistSync = sinon.stub(fs, "existsSync");
const fsMkdirSync = sinon.stub(fs, "mkdirSync");
const axiosGet = sinon.stub(axios, "get");
const fsReadFileSync = sinon.stub(fs, "readFileSync");
const fsWriteFileSync = sinon.stub(fs, "writeFileSync");
const fsCopyFileSync = sinon.stub(fs, "copyFileSync");
const consoleLog = sinon.stub(console, "log");

sinon.replace(
  fs,
  "lstatSync",
  sinon.fake.returns({
    isDirectory: () => true,
    isFile: () => true,
  }),
);

const registryYaml = `
version: 1

chains:
  local_wasm:
    chain_id: testing
    prefix: wasm
    gas_price: 0.025ucosm
    hd_path: m/44'/108'/0'/2'
    rpc:
      - http://localhost:26659
  local_gaia:
    chain_id: gaia-testing
    prefix: cosmos
    gas_price: 0.025uatom
    hd_path: m/44'/108'/0'/3'
    rpc:
      - http://localhost:26655`;

test.beforeEach(() => {
  sinon.reset();
});

test("creates app.yaml", async (t) => {
  const options: Options = {
    home: "/home/user",
    src: "local_wasm",
    dest: "local_gaia",
    registryFrom: null,
  };
  const appPath = path.join(options.home, "app.yaml");
  const registryPath = path.join(options.home, "registry.yaml");

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

  const [calledAppPath, contents] = fsWriteFileSync.getCall(0).args;
  const appYamlRegexp = new RegExp(
    `src: ${options.src}\ndest: ${options.dest}\nmnemonic: [\\w ]+`,
    "mg",
  );
  t.is(calledAppPath, appPath);
  t.regex(contents as string, appYamlRegexp);

  t.assert(consoleLog.getCall(-2).calledWithMatch(/Source address: [\w ]+/));
  t.assert(
    consoleLog.getCall(-1).calledWithMatch(/Destination address: [\w ]+/),
  );
});

test.only("initialize home directory, pull registry.yaml and create app.yaml", async (t) => {
  const options: Options = {
    home: "/home/user",
    src: "local_wasm",
    dest: "local_gaia",
    registryFrom: null,
  };
  const appPath = path.join(options.home, "app.yaml");
  const registryPath = path.join(options.home, "registry.yaml");

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

  const [calledAppPath, contents] = fsWriteFileSync.getCall(1).args;
  const appYamlRegexp = new RegExp(
    `src: ${options.src}\ndest: ${options.dest}\nmnemonic: [\\w ]+`,
    "mg",
  );
  t.is(calledAppPath, appPath);
  t.regex(contents as string, appYamlRegexp);

  t.assert(consoleLog.getCall(-2).calledWithMatch(/Source address: [\w ]+/));
  t.assert(
    consoleLog.getCall(-1).calledWithMatch(/Destination address: [\w ]+/),
  );
});

test("throws when cannot fetch registry.yaml from remote", async (t) => {
  const options: Options = {
    home: "/home/user",
    src: "local_wasm",
    dest: "local_gaia",
    registryFrom: null,
  };

  fsExistSync.returns(false);
  fsMkdirSync.returns(options.home);
  axiosGet.rejects();
  fsReadFileSync.returns("");
  fsWriteFileSync.returns();

  await t.throwsAsync(async () => await run(options), {
    instanceOf: Error,
    message: /Cannot fetch registry.yaml/,
  });

  t.assert(fsMkdirSync.calledOnceWith(options.home));
  t.assert(axiosGet.calledOnce);
});

test("returns early if app.yaml exists", async (t) => {
  const options: Options = {
    home: "/home/user",
    src: "local_wasm",
    dest: "local_gaia",
    registryFrom: null,
  };

  fsExistSync.onCall(0).returns(true);

  await run(options);

  t.assert(fsExistSync.calledOnce);
  t.assert(consoleLog.calledWithMatch(/app.yaml is already initialized/));
  t.assert(consoleLog.calledOnce);
});

test("throws if provided chain does not exist in the registry", async (t) => {
  const options: Options = {
    home: "/home/user",
    src: "chain_that_does_not_exist",
    dest: "local_gaia",
    registryFrom: null,
  };
  const registryPath = path.join(options.home, "registry.yaml");

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
    message: new RegExp(`${options.src} is missing in the registry`),
  });

  t.assert(fsMkdirSync.notCalled);
  t.assert(axiosGet.notCalled);
  t.assert(fsReadFileSync.calledOnceWith(registryPath));
});

test("copies existing registry", async (t) => {
  const options: Options = {
    home: "/home/user",
    src: "local_wasm",
    dest: "local_gaia",
    registryFrom: "/home/user/.relayer-home",
  };
  const appPath = path.join(options.home, "app.yaml");
  const registryPath = path.join(options.home, "registry.yaml");

  fsExistSync.returns(false);
  fsMkdirSync.returns(options.home);
  fsReadFileSync.returns(registryYaml);
  fsWriteFileSync.returns();
  fsCopyFileSync.returns();

  await run(options);

  t.assert(axiosGet.notCalled);
  t.assert(fsReadFileSync.calledOnceWith(registryPath));
  t.assert(
    fsCopyFileSync.calledOnceWith(
      path.join(options.registryFrom as string, registryFile),
      registryPath,
    ),
  );

  const [calledAppPath, contents] = fsWriteFileSync.getCall(0).args;
  const appYamlRegexp = new RegExp(
    `src: ${options.src}\ndest: ${options.dest}\nmnemonic: [\\w ]+`,
    "mg",
  );
  t.is(calledAppPath, appPath);
  t.regex(contents as string, appYamlRegexp);

  t.assert(consoleLog.getCall(-2).calledWithMatch(/Source address: [\w ]+/));
  t.assert(
    consoleLog.getCall(-1).calledWithMatch(/Destination address: [\w ]+/),
  );
});

test('exits earlier when "src" and "dest" are not set', async (t) => {
  const options: Options = {
    home: "/home/user",
    src: null,
    dest: null,
    registryFrom: null,
  };

  fsExistSync.onCall(0).returns(false).onCall(1).returns(false);
  axiosGet.resolves({
    data: registryYaml,
  });
  fsReadFileSync.returns(registryYaml);
  fsWriteFileSync.returns();

  await run(options);

  t.assert(consoleLog.getCall(-1).calledWithMatch(/Exited earlier/));
  t.is(fsExistSync.callCount, 3);
});
