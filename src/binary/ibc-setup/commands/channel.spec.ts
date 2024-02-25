import fs from "fs";
import os from "os";

import { assert } from "@cosmjs/utils";
import test from "ava";
import sinon from "sinon";

import { testutils } from "../../../lib";
import { Link } from "../../../lib/link";
import { Logger } from "../../create-logger";
import { indent } from "../../utils/indent";
import { signingClient } from "../../utils/signing-client";

const { TestLogger } = testutils;

import { gaiaChain, wasmdChain } from "./chains";
import { Options, run } from "./channel";

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

test.serial("creates channel for given connections and ports", async (t) => {
  const logger = new TestLogger();

  const ibcClientGaia = await signingClient(gaiaChain, mnemonic);
  const ibcClientWasm = await signingClient(wasmdChain, mnemonic);
  const link = await Link.createWithNewConnections(
    ibcClientWasm,
    ibcClientGaia,
  );

  const options: Options = {
    home: "/home/user",
    mnemonic,
    src: "local_wasm",
    dest: "local_gaia",
    srcConnection: link.endA.connectionID,
    destConnection: link.endB.connectionID,
    srcPort: "transfer",
    destPort: "custom",
    ordered: false,
    version: "ics20-1",
  };

  fsReadFileSync.returns(registryYaml);

  await run(options, logger as unknown as Logger);

  t.assert(consoleLog.calledWithMatch(/Created channel:/));

  const output = consoleLog.getCall(-1).args[0] as string;
  const match = output.match(
    new RegExp(
      [
        "Created channel:",
        ...indent([
          ".+: (?<srcPort>.+)/(?<srcChannel>.+) \\(.+\\)",
          ".+: (?<destPort>.+)/(?<destChannel>.+) \\(.+\\)",
        ]),
      ].join(os.EOL),
    ),
  );

  assert(match);
  assert(match.groups);

  const querySrcChannel = await ibcClientWasm.query.ibc.channel.channel(
    match.groups.srcPort,
    match.groups.srcChannel,
  );
  t.assert(querySrcChannel.channel);

  const queryDestChannel = await ibcClientGaia.query.ibc.channel.channel(
    match.groups.destPort,
    match.groups.destChannel,
  );
  t.assert(queryDestChannel.channel);
});
