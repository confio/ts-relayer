#!/usr/bin/env node
/*jshint esversion: 8 */

/* eslint-disable @typescript-eslint/naming-convention */
const axios = require("axios");
const { SigningCosmWasmClient } = require("@cosmjs/cosmwasm-stargate");
const { GasPrice } = require("@cosmjs/stargate");
const { DirectSecp256k1HdWallet } = require("@cosmjs/proto-signing");

// from src/lib/testutils.ts:wasmd
const config = {
  endpoint: "http://localhost:26659",
  bech32prefix: "wasm",
  feeDenom: "ucosm",
  gasPrice: GasPrice.fromString("0.025ucosm"),
  mnemonic: "enlist hip relief stomach skate base shallow young switch frequent cry park",
};

const wasmUrl = "https://github.com/CosmWasm/cosmwasm-plus/releases/download/v0.6.1/cw20_base.wasm";

const codeMeta = {
  source: "https://github.com/CosmWasm/cosmwasm-plus/tree/v0.6.0/contracts/cw20-base",
  builder: "cosmwasm/workspace-optimizer:0.11.0",
};

const addresses = [
  "wasm1lk46aknye76sgfv65v5zcyyld0fnuu5jg02hs8",
];
const initDataHash = {
  admin: undefined,
  initMsg: {
    decimals: 5,
    name: "Hash token",
    symbol: "HASH",
    initial_balances: addresses.map((address) => ({
      address,
      amount: "123456",
    })),
  },
};

async function downloadWasm(url) {
  const r = await axios.get(url, { responseType: "arraybuffer" });
  if (r.status !== 200) {
    throw new Error(`Download error: ${r.status}`);
  }
  return r.data;
}

async function main() {
  // use the faucet account to upload (it has fee tokens)
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(config.mnemonic, { prefix: config.bech32prefix});
  const { address } = (await wallet.getAccounts())[0];
  const options = { prefix: config.bech32prefix, gasPrice: config.gasPrice };
  const client = await SigningCosmWasmClient.connectWithSigner(config.endpoint, wallet, options);

  console.info(`Downloading ${wasmUrl}...`);
  const wasm = await downloadWasm(wasmUrl);
  const uploadReceipt = await client.upload(address, wasm, codeMeta, "Upload CW-20 Base");
  console.info(`Upload succeeded. Receipt: ${JSON.stringify(uploadReceipt)}`);
}

main().then(
  () => {
    console.info("All done, let the coins flow.");
    process.exit(0);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
