import { fromUtf8, toBase64, toUtf8 } from '@cosmjs/encoding';
import { assert } from '@cosmjs/utils';
import test from 'ava';
import axios from 'axios';

import { Link } from './link';
import { CosmWasmSigner, ics20, setup, setupWasmClient } from './testutils';

const codeIds: Record<string, number> = {
  cw20: 0,
  ics20: 0,
};

interface WasmData {
  wasmUrl: string;
  codeMeta: {
    source: string;
    builder: string;
  };
}

const contracts: Record<string, WasmData> = {
  cw20: {
    wasmUrl:
      'https://github.com/CosmWasm/cosmwasm-plus/releases/download/v0.6.1/cw20_base.wasm',
    codeMeta: {
      source:
        'https://github.com/CosmWasm/cosmwasm-plus/tree/v0.6.0/contracts/cw20-base',
      builder: 'cosmwasm/workspace-optimizer:0.11.0',
    },
  },
  ics20: {
    wasmUrl:
      'https://github.com/CosmWasm/cosmwasm-plus/releases/download/v0.6.1/cw20_ics20.wasm',
    codeMeta: {
      source:
        'https://github.com/CosmWasm/cosmwasm-plus/tree/v0.6.0/contracts/cw20-ics20',
      builder: 'cosmwasm/workspace-optimizer:0.11.0',
    },
  },
};

async function downloadWasm(url: string) {
  const r = await axios.get(url, { responseType: 'arraybuffer' });
  if (r.status !== 200) {
    throw new Error(`Download error: ${r.status}`);
  }
  return r.data;
}

test.before(async (t) => {
  const cosmwasm = await setupWasmClient();

  for (const name in contracts) {
    const contract = contracts[name];
    console.info(`Downloading ${name} at ${contract.wasmUrl}...`);
    const wasm = await downloadWasm(contract.wasmUrl);
    const receipt = await cosmwasm.sign.upload(
      cosmwasm.senderAddress,
      wasm,
      contract.codeMeta,
      `Upload ${name}`
    );
    console.debug(`Upload ${name} with CodeID: ${receipt.codeId}`);
    codeIds[name] = receipt.codeId;
  }

  t.pass();
});

// creates it with 6 decimal places
// provides 123456.789 tokens to the creator
function cw20init(owner: string, symbol: string): Record<string, unknown> {
  return {
    decimals: 6,
    name: symbol,
    symbol,
    initial_balances: [
      {
        address: owner,
        amount: '123456789000',
      },
    ],
  };
}

async function balance(
  cosmwasm: CosmWasmSigner,
  cw20Addr: string,
  senderAddress?: string
): Promise<string> {
  const query = {
    balance: {
      address: senderAddress || cosmwasm.senderAddress,
    },
  };
  const res = await cosmwasm.sign.queryContractSmart(cw20Addr, query);
  // print this
  return res.balance;
}

test.serial('successfully instantiate contracts', async (t) => {
  const cosmwasm = await setupWasmClient();

  // instantiate cw20
  const initMsg = cw20init(cosmwasm.senderAddress, 'DEMO');
  const { contractAddress: cw20Addr } = await cosmwasm.sign.instantiate(
    cosmwasm.senderAddress,
    codeIds.cw20,
    initMsg,
    'DEMO'
  );
  t.truthy(cw20Addr);

  const bal = await balance(cosmwasm, cw20Addr);
  t.is('123456789000', bal);

  // instantiate ics20
  const ics20Msg = {
    default_timeout: 3600,
  };
  const { contractAddress: ics20Addr } = await cosmwasm.sign.instantiate(
    cosmwasm.senderAddress,
    codeIds.ics20,
    ics20Msg,
    'ICS'
  );
  t.truthy(ics20Addr);
});

test.serial('set up channel with ics20 contract', async (t) => {
  const cosmwasm = await setupWasmClient();

  // instantiate ics20
  const ics20Msg = {
    default_timeout: 3600,
  };
  const { contractAddress: ics20Addr } = await cosmwasm.sign.instantiate(
    cosmwasm.senderAddress,
    codeIds.ics20,
    ics20Msg,
    'ICS'
  );
  t.truthy(ics20Addr);

  // FIXME: query this when https://github.com/cosmos/cosmjs/issues/836 is resolved
  const wasmPort = `wasm.${ics20Addr}`;

  const [src, dest] = await setup();
  const link = await Link.createWithNewConnections(src, dest);
  await link.createChannel(
    'A',
    ics20.srcPortId,
    wasmPort,
    ics20.ordering,
    ics20.version
  );
});

test.serial('send packets with ics20 contract', async (t) => {
  const cosmwasm = await setupWasmClient();

  // instantiate cw20
  const initMsg = cw20init(cosmwasm.senderAddress, 'CASH');
  const { contractAddress: cw20Addr } = await cosmwasm.sign.instantiate(
    cosmwasm.senderAddress,
    codeIds.cw20,
    initMsg,
    'CASH'
  );
  t.truthy(cw20Addr);
  let bal = await balance(cosmwasm, cw20Addr);
  t.is('123456789000', bal);

  // instantiate ics20
  const ics20Msg = {
    default_timeout: 3600,
  };
  const { contractAddress: ics20Addr } = await cosmwasm.sign.instantiate(
    cosmwasm.senderAddress,
    codeIds.ics20,
    ics20Msg,
    'ICSX'
  );
  t.truthy(ics20Addr);
  // FIXME: query this when https://github.com/cosmos/cosmjs/issues/836 is resolved
  const wasmPort = `wasm.${ics20Addr}`;

  const [src, dest] = await setup();
  const link = await Link.createWithNewConnections(src, dest);
  const channels = await link.createChannel(
    'A',
    ics20.srcPortId,
    wasmPort,
    ics20.ordering,
    ics20.version
  );

  // send a packet from the ics20 contract.... (on dest chain)
  const receiveMsg = {
    channel: channels.dest.channelId,
    remote_address: src.senderAddress,
  };
  const encoded = toBase64(toUtf8(JSON.stringify(receiveMsg)));
  const sendMsg = {
    send: {
      contract: ics20Addr,
      amount: '456789000', // leaving 123000.0000000 tokens
      msg: encoded,
    },
  };
  await cosmwasm.sign.execute(
    cosmwasm.senderAddress,
    cw20Addr,
    sendMsg,
    'Send CW20 tokens via ICS20'
  );

  // let's see if the balance went down
  bal = await balance(cosmwasm, cw20Addr);
  t.is('123000000000', bal);

  // check source balance
  const preBalance = await src.sign.getAllBalances(src.senderAddress);
  t.is(1, preBalance.length);
  t.is('umuon', preBalance[0].denom);

  // ensure the packet moves
  const packets = await link.getPendingPackets('B');
  t.is(packets.length, 1);
  const preAcks = await link.getPendingAcks('A');
  t.is(preAcks.length, 0);
  // move it and the ack
  const txAcks = await link.relayPackets('B', packets);
  t.is(txAcks.length, 1);
  const parsedAck1 = JSON.parse(fromUtf8(txAcks[0].acknowledgement));
  t.truthy(parsedAck1.result);
  t.falsy(parsedAck1.error);

  // need to wait briefly for it to be indexed
  await src.waitOneBlock();
  // and send the acks over
  await link.relayAcks('A', txAcks);

  // check source balances increased
  const relayedBalance = await src.sign.getAllBalances(src.senderAddress);
  t.is(2, relayedBalance.length);
  const ibcCoin = relayedBalance.find((d) => d.denom !== 'umuon');
  assert(ibcCoin);
  t.is('456789000', ibcCoin.amount);
  console.log(ibcCoin);

  // send this token back over the channel
  const timeoutHeight = await dest.timeoutHeight(500);
  await src.transferTokens(
    channels.src.portId,
    channels.src.channelId,
    ibcCoin,
    dest.senderAddress,
    timeoutHeight
  );
  await src.waitOneBlock();

  // ensure the packet moves
  const packets2 = await link.getPendingPackets('A');
  t.is(packets2.length, 1);
  // move it and the ack
  const txAcks2 = await link.relayPackets('A', packets2);
  t.is(txAcks2.length, 1);
  // need to wait briefly for it to be indexed
  await dest.waitOneBlock();
  // and send the acks over
  await link.relayAcks('B', txAcks2);

  // balance updated on recipient
  const gotBal = await balance(cosmwasm, cw20Addr, dest.senderAddress);
  t.is(gotBal, '456789000');

  // send native token over channel (from dest -> cosmwasm chain)
  const timeoutHeight2 = await dest.timeoutHeight(500);
  const nativeCoin = {
    denom: 'umuon',
    amount: '111111',
  };
  await src.transferTokens(
    channels.src.portId,
    channels.src.channelId,
    nativeCoin,
    dest.senderAddress,
    timeoutHeight2
  );
  await src.waitOneBlock();

  // relay this packet
  const packets3 = await link.getPendingPackets('A');
  t.is(packets3.length, 1);
  const txAcks3 = await link.relayPackets('A', packets3);
  t.is(txAcks3.length, 1);
  // and expect error on ack
  const parsedAck = JSON.parse(fromUtf8(txAcks3[0].acknowledgement));
  t.truthy(parsedAck.error);
  t.falsy(parsedAck.result);
});
