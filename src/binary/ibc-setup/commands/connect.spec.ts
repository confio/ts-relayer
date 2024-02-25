import fs from "fs";
import path from "path";

import { assert } from "@cosmjs/utils";
import test from "ava";
import sinon from "sinon";

import { testutils } from "../../../lib";
import { appFile } from "../../constants";
import { Logger } from "../../create-logger";
import { signingClient } from "../../utils/signing-client";

import { gaiaChain, wasmdChain } from "./chains";
import { Options, run } from "./connect";

const { TestLogger } = testutils;

const fsWriteFileSync = sinon.stub(fs, "writeFileSync");
const fsReadFileSync = sinon.stub(fs, "readFileSync");
const consoleLog = sinon.stub(console, "log");

const mnemonic =
  "enlist hip relief stomach skate base shallow young switch frequent cry park";

const registryYaml = `
version: 1

chains:
  local_wasm:
    chain_id: testing
    prefix: wasm
    gas_price: 0.025ucosm
    rpc:
      - http://localhost:26659
  local_gaia:
    chain_id: gaia-testing
    prefix: cosmos
    gas_price: 0.025uatom
    rpc:
      - http://localhost:26655`;

const registryYamlTooLowGas = `
version: 1

chains:
  local_wasm:
    chain_id: testing
    prefix: wasm
    gas_price: 0.001ucosm
    rpc:
      - http://localhost:26659
  local_gaia:
    chain_id: gaia-testing
    prefix: cosmos
    # this will fail
    gas_price: 0.001uatom
    rpc:
      - http://localhost:26655`;

const registryYamlHigherGas = `
version: 1

chains:
  local_wasm:
    chain_id: testing
    prefix: wasm
    gas_price: 0.075ucosm
    rpc:
      - http://localhost:26659
  local_gaia:
    chain_id: gaia-testing
    prefix: cosmos
    gas_price: 0.075uatom
    rpc:
      - http://localhost:26655`;

const app = {
  src: "local_wasm",
  dest: "local_gaia",
};

test.beforeEach(() => {
  sinon.reset();
});

test.serial("connects two chains", async (t) => {
  const logger = new TestLogger();

  const ibcClientGaia = await signingClient(gaiaChain, mnemonic);
  const ibcClientWasm = await signingClient(wasmdChain, mnemonic);

  const allConnectionsWasm =
    await ibcClientWasm.query.ibc.connection.allConnections();
  const allConnectionsGaia =
    await ibcClientGaia.query.ibc.connection.allConnections();

  const options: Options = {
    home: "/home/user",
    mnemonic,
    src: "local_gaia",
    dest: "local_wasm",
    srcTrust: null,
    destTrust: null,
  };

  fsReadFileSync.returns(registryYaml);
  fsWriteFileSync.returns();

  await run(options, app, logger as unknown as Logger);

  const args = fsWriteFileSync.getCall(0).args as [string, string];
  const contentsRegexp = new RegExp(
    `src: local_wasm
dest: local_gaia
srcConnection: .+
destConnection: .+
`,
  );
  t.assert(fsWriteFileSync.calledOnce);
  t.is(args[0], path.join(options.home, appFile));
  t.regex(args[1], contentsRegexp);
  t.assert(consoleLog.calledOnce);
  t.assert(consoleLog.calledWithMatch(/Created connections/));

  const nextAllConnectionsWasm =
    await ibcClientWasm.query.ibc.connection.allConnections();
  const destConnectionIdMatch = /destConnection: (?<connection>.+)/.exec(
    args[1],
  );
  const destConnectionId = destConnectionIdMatch?.groups?.connection;
  assert(destConnectionId);
  const nextConnectionWasm =
    await ibcClientWasm.query.ibc.connection.connection(destConnectionId);

  const nextAllConnectionsGaia =
    await ibcClientGaia.query.ibc.connection.allConnections();
  const srcConnectionIdMatch = /srcConnection: (?<connection>.+)/.exec(args[1]);
  const srcConnectionId = srcConnectionIdMatch?.groups?.connection;
  assert(srcConnectionId);
  const nextConnectionGaia =
    await ibcClientGaia.query.ibc.connection.connection(srcConnectionId);

  t.is(
    nextAllConnectionsWasm.connections.length,
    allConnectionsWasm.connections.length + 1,
  );
  t.is(
    nextAllConnectionsGaia.connections.length,
    allConnectionsGaia.connections.length + 1,
  );
  t.assert(nextConnectionWasm.connection);
  t.assert(nextConnectionGaia.connection);
});

test.serial("connects two chains fails with too low gas", async (t) => {
  const logger = new TestLogger();

  const ibcClientGaia = await signingClient(gaiaChain, mnemonic);
  const ibcClientWasm = await signingClient(wasmdChain, mnemonic);

  const allConnectionsWasm =
    await ibcClientWasm.query.ibc.connection.allConnections();
  const allConnectionsGaia =
    await ibcClientGaia.query.ibc.connection.allConnections();

  const options: Options = {
    home: "/home/user",
    mnemonic,
    src: "local_gaia",
    dest: "local_wasm",
    srcTrust: null,
    destTrust: null,
  };

  fsReadFileSync.returns(registryYamlTooLowGas);
  fsWriteFileSync.returns();

  // this should throw an error when trying to set up the connection
  await t.throwsAsync(() => run(options, app, logger as unknown as Logger));

  const nextAllConnectionsWasm =
    await ibcClientWasm.query.ibc.connection.allConnections();
  const nextAllConnectionsGaia =
    await ibcClientGaia.query.ibc.connection.allConnections();
  // no connection can be made
  t.is(
    nextAllConnectionsWasm.connections.length,
    allConnectionsWasm.connections.length,
  );
  t.is(
    nextAllConnectionsGaia.connections.length,
    allConnectionsGaia.connections.length,
  );
});

test.serial("connects two chains with explicit high gas works", async (t) => {
  const logger = new TestLogger();

  const ibcClientGaia = await signingClient(gaiaChain, mnemonic);
  const ibcClientWasm = await signingClient(wasmdChain, mnemonic);

  const allConnectionsWasm =
    await ibcClientWasm.query.ibc.connection.allConnections();
  const allConnectionsGaia =
    await ibcClientGaia.query.ibc.connection.allConnections();

  const options: Options = {
    home: "/home/user",
    mnemonic,
    src: "local_gaia",
    dest: "local_wasm",
    srcTrust: null,
    destTrust: null,
  };

  fsReadFileSync.returns(registryYamlHigherGas);
  fsWriteFileSync.returns();

  // this will NOT fail
  await run(options, app, logger as unknown as Logger);

  const nextAllConnectionsWasm =
    await ibcClientWasm.query.ibc.connection.allConnections();
  const nextAllConnectionsGaia =
    await ibcClientGaia.query.ibc.connection.allConnections();
  // one connection is made
  t.is(
    nextAllConnectionsWasm.connections.length,
    allConnectionsWasm.connections.length + 1,
  );
  t.is(
    nextAllConnectionsGaia.connections.length,
    allConnectionsGaia.connections.length + 1,
  );
});
