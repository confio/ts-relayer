import fs from "fs";

import test from "ava";
import sinon from "sinon";

import { testutils } from "../../../lib";
import { Link } from "../../../lib/link";
import { Logger } from "../../create-logger";
import { signingClient } from "../../utils/signing-client";

import { gaiaChain, wasmdChain } from "./chains";
import { Options, run } from "./connections";

const { TestLogger } = testutils;

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

test.serial("lists connections", async (t) => {
  const logger = new TestLogger();

  const ibcClientGaia = await signingClient(gaiaChain, mnemonic);
  const ibcClientWasm = await signingClient(wasmdChain, mnemonic);

  const link = await Link.createWithNewConnections(
    ibcClientGaia,
    ibcClientWasm,
  );

  const options: Options = {
    home: "/home/user",
    mnemonic,
    chain: "local_gaia",
  };

  fsReadFileSync.returns(registryYaml);

  await run(options, logger as unknown as Logger);

  const tableRow = [link.endA.connectionID, link.endA.clientID, 0, "Open"];
  const match = new RegExp(tableRow.join("\\s+"));
  t.assert(consoleLog.getCall(-1).calledWithMatch(match));
});

// TODO: #130
// test.serial('logs a message when no connections are found', async (t) => {
//   //
// });
