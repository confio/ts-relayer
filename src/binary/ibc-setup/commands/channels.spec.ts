import fs from "fs";
import os from "os";

import test from "ava";
import { State as ChannelState } from "cosmjs-types/ibc/core/channel/v1/channel";
import sinon from "sinon";

import { testutils } from "../../../lib";
import { ChannelPair, Link } from "../../../lib/link";
import { Logger } from "../../create-logger";
import { signingClient } from "../../utils/signing-client";

const { TestLogger } = testutils;

const { ics20 } = testutils;

import { gaiaChain, wasmdChain } from "./chains";
import { channelStateAsText, Options, run } from "./channels";

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

test.beforeEach(() => {
  sinon.reset();
});

let channel: ChannelPair;
let link: Link;

test.before(async () => {
  const ibcClientGaia = await signingClient(gaiaChain, mnemonic);
  const ibcClientWasm = await signingClient(wasmdChain, mnemonic);
  link = await Link.createWithNewConnections(ibcClientGaia, ibcClientWasm);
  channel = await link.createChannel(
    "A",
    gaiaChain.ics20Port,
    wasmdChain.ics20Port,
    ics20.ordering,
    ics20.version,
  );
});

test("lists channels for given chain (A)", async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    chain: "local_gaia",
    port: null,
    connection: null,
    mnemonic: null,
    home: "/home/user",
  };

  fsReadFileSync.returns(registryYaml);

  await run(options, logger as unknown as Logger);

  const output = consoleLog.getCall(-1);

  t.assert(
    output.calledWithMatch(
      new RegExp(
        [
          channel.src.channelId,
          channel.src.portId,
          link.endA.connectionID,
          channelStateAsText(ChannelState.STATE_OPEN),
        ].join("\\s+"),
        "m",
      ),
    ),
  );
});

test("lists channels for given chain (B)", async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    chain: "local_wasm",
    port: null,
    connection: null,
    mnemonic: null,
    home: "/home/user",
  };

  fsReadFileSync.returns(registryYaml);

  await run(options, logger as unknown as Logger);

  const output = consoleLog.getCall(-1);

  t.assert(
    output.calledWithMatch(
      new RegExp(
        [
          channel.dest.channelId,
          channel.dest.portId,
          link.endB.connectionID,
          channelStateAsText(ChannelState.STATE_OPEN),
        ].join("\\s+"),
        "m",
      ),
    ),
  );
});

test("filters channels by port", async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    chain: "local_gaia",
    port: channel.src.portId,
    connection: null,
    mnemonic: null,
    home: "/home/user",
  };

  fsReadFileSync.returns(registryYaml);

  await run(options, logger as unknown as Logger);

  const output = consoleLog.getCall(-1).args[0] as string;

  const everyChannelHasValidPort = output
    .split(os.EOL)
    .slice(1, -1) // remove table head and last empty line
    .every((value) =>
      new RegExp(`[^\\s]+\\s+${options.port}\\s+[^\\s]+\\s+[^\\s]+`).test(
        value,
      ),
    );

  t.notRegex(output, /No channels found/);
  t.assert(everyChannelHasValidPort);
});

test("filters channels by port (non-existing port)", async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    chain: "local_gaia",
    port: "unknown_port",
    connection: null,
    mnemonic: null,
    home: "/home/user",
  };

  fsReadFileSync.returns(registryYaml);

  await run(options, logger as unknown as Logger);

  t.assert(consoleLog.getCall(-1).calledWithMatch(/No channels found/));
});

test("filters channels by connection", async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    chain: "local_wasm",
    port: null,
    connection: link.endA.connectionID,
    mnemonic: null,
    home: "/home/user",
  };

  fsReadFileSync.returns(registryYaml);

  await run(options, logger as unknown as Logger);

  const output = consoleLog.getCall(-1).args[0] as string;

  const everyChannelHasValidConnection = output
    .split(os.EOL)
    .slice(1, -1) // remove table head and last empty line
    .every((value) =>
      new RegExp(`[^\\s]+\\s+[^\\s]+\\s+${options.connection}\\s+[^\\s]+`).test(
        value,
      ),
    );

  t.notRegex(output, /No channels found/);
  t.assert(everyChannelHasValidConnection);
});

test("filters channels by connection (non-existing connection)", async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    chain: "local_gaia",
    port: null,
    connection: "unknown_connection",
    mnemonic: null,
    home: "/home/user",
  };

  fsReadFileSync.returns(registryYaml);

  await run(options, logger as unknown as Logger);

  t.assert(consoleLog.getCall(-1).calledWithMatch(/No channels found/));
});

test("filters channels by port and connection", async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    chain: "local_gaia",
    port: channel.src.portId,
    connection: link.endA.connectionID,
    mnemonic: null,
    home: "/home/user",
  };

  fsReadFileSync.returns(registryYaml);

  await run(options, logger as unknown as Logger);

  const output = consoleLog.getCall(-1).args[0] as string;

  const everyChannelHasValidPortAndConnection = output
    .split(os.EOL)
    .slice(1, -1) // remove table head and last empty line
    .every((value) =>
      new RegExp(
        `[^\\s]+\\s+${options.port}\\s+${options.connection}\\s+[^\\s]+`,
      ).test(value),
    );

  t.notRegex(output, /No channels found/);
  t.assert(everyChannelHasValidPortAndConnection);
});

test("filters channels by port and connection (non-existing connection)", async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    chain: "local_gaia",
    port: channel.src.portId,
    connection: "unknown_connection",
    mnemonic: null,
    home: "/home/user",
  };

  fsReadFileSync.returns(registryYaml);

  await run(options, logger as unknown as Logger);

  t.assert(consoleLog.getCall(-1).calledWithMatch(/No channels found/));
});
