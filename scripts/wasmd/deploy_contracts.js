#!/usr/bin/env node
/*jshint esversion: 8 */

/* eslint-disable @typescript-eslint/naming-convention */
const axios = require('axios');
const { SigningCosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
const { GasPrice } = require('@cosmjs/stargate');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');

// from src/lib/testutils.ts:wasmd
const config = {
  endpoint: 'http://localhost:26659',
  bech32prefix: 'wasm',
  feeDenom: 'ucosm',
  gasPrice: GasPrice.fromString('0.025ucosm'),
  mnemonic:
    'enlist hip relief stomach skate base shallow young switch frequent cry park',
};

const contracts = [
  {
    name: 'cw20-base',
    wasmUrl:
      'https://github.com/CosmWasm/cosmwasm-plus/releases/download/v0.13.1/cw20_base.wasm',
  },
  {
    name: 'cw20-ics20',
    wasmUrl:
      'https://github.com/CosmWasm/cosmwasm-plus/releases/download/v0.13.1/cw20_ics20.wasm',
  },
];

async function downloadWasm(url) {
  const r = await axios.get(url, { responseType: 'arraybuffer' });
  if (r.status !== 200) {
    throw new Error(`Download error: ${r.status}`);
  }
  return r.data;
}

async function main() {
  // use the faucet account to upload (it has fee tokens)
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(config.mnemonic, {
    prefix: config.bech32prefix,
  });
  const { address } = (await wallet.getAccounts())[0];
  const options = {
    prefix: config.bech32prefix,
    gasPrice: config.gasPrice,
  };
  const client = await SigningCosmWasmClient.connectWithSigner(
    config.endpoint,
    wallet,
    options
  );

  const uploaded = [];
  for (const contract of contracts) {
    console.info(`Downloading ${contract.name} at ${contract.wasmUrl}...`);
    const wasm = await downloadWasm(contract.wasmUrl);
    const receipt = await client.upload(
      address,
      wasm,
      'auto',
      `Upload ${contract.name}`
    );
    console.debug(`Upload succeeded. Receipt: ${JSON.stringify(receipt)}`);
    uploaded.push({ codeId: receipt.codeId, name: contract.name });
  }

  uploaded.forEach((x) => console.log(x));
}

main().then(
  () => {
    console.info('All done, let the coins flow.');
    process.exit(0);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
