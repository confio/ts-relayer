import fs from "fs";
import os from "os";

import test from "ava";
import sinon from "sinon";

import { testutils } from "../../../lib";
import { IbcClient } from "../../../lib/ibcclient";
import { Logger } from "../../create-logger";

import { run } from "./balances";
import { Options } from "./keys-list";

const { TestLogger } = testutils;

const fsReadFileSync = sinon.stub(fs, "readFileSync");
const consoleLog = sinon.stub(console, "log");
const mnemonic =
  "accident harvest weasel surge source return tag supreme sorry isolate wave mammal";

function buildIbcArgs(rpc: string) {
  return [rpc, sinon.match.any, sinon.match.any, sinon.match.any] as const;
}
const ibcClient = sinon.stub(IbcClient, "connectWithSigner");
const musselnetArgs = buildIbcArgs("https://rpc.musselnet.cosmwasm.com:443");
const localWasmArgs = buildIbcArgs("http://localhost:26659");
const localGaiaArgs = buildIbcArgs("http://localhost:26655");

async function createFakeIbcClient(amount: string, denom: string) {
  return {
    query: {
      bank: {
        balance: sinon.fake.returns({ amount, denom }),
      },
    },
  } as unknown as IbcClient;
}

test.beforeEach(() => {
  sinon.reset();
});

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
  local_gaia:
    chain_id: gaia-testing
    prefix: cosmos
    gas_price: 0.025uatom
    hd_path: m/44'/1234'/0'/3'
    rpc:
      - http://localhost:26655`;

test("lists chains with non-zero balance", async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    home: "/home/user",
    mnemonic,
  };

  fsReadFileSync.returns(registryYaml);
  ibcClient
    .withArgs(...musselnetArgs)
    .returns(createFakeIbcClient("1", "musselnetdenom"))
    .withArgs(...localWasmArgs)
    .returns(createFakeIbcClient("2", "wasmdenom"))
    .withArgs(...localGaiaArgs)
    .returns(createFakeIbcClient("3", "gaiadenom"));

  await run(options, logger as unknown as Logger);

  t.assert(fsReadFileSync.calledOnce);
  t.assert(consoleLog.calledOnce);
  t.assert(
    consoleLog.calledWithMatch(
      new RegExp(
        [
          "musselnet\\s+1musselnetdenom\\s+",
          "local_wasm\\s+2wasmdenom\\s+",
          "local_gaia\\s+3gaiadenom\\s+",
        ].join(os.EOL),
      ),
    ),
  );
});

test("omits chains with zero balance", async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    home: "/home/user",
    mnemonic,
  };

  fsReadFileSync.returns(registryYaml);
  ibcClient
    .withArgs(...musselnetArgs)
    .returns(createFakeIbcClient("1", "musselnetdenom"))
    .withArgs(...localWasmArgs)
    .returns(createFakeIbcClient("0", "wasmdenom"))
    .withArgs(...localGaiaArgs)
    .returns(createFakeIbcClient("3", "gaiadenom"));

  await run(options, logger as unknown as Logger);

  t.assert(fsReadFileSync.calledOnce);
  t.assert(consoleLog.calledOnce);
  t.assert(
    consoleLog.calledWithMatch(
      new RegExp(
        [
          "musselnet\\s+1musselnetdenom\\s+",
          "local_gaia\\s+3gaiadenom\\s+",
        ].join(os.EOL),
      ),
    ),
  );
});

test("informs when there are no funds on any balance", async (t) => {
  const logger = new TestLogger();

  const options: Options = {
    home: "/home/user",
    mnemonic,
  };

  fsReadFileSync.returns(registryYaml);
  ibcClient
    .withArgs(...musselnetArgs)
    .returns(createFakeIbcClient("0", "musselnetdenom"))
    .withArgs(...localWasmArgs)
    .returns(createFakeIbcClient("0", "wasmdenom"))
    .withArgs(...localGaiaArgs)
    .returns(createFakeIbcClient("0", "gaiadenom"));

  await run(options, logger as unknown as Logger);

  t.assert(fsReadFileSync.calledOnce);
  t.assert(consoleLog.calledOnce);
  t.assert(consoleLog.calledWithMatch(/No funds/));
});
