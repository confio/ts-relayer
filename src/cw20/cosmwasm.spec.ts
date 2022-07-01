import { fromUtf8 } from '@cosmjs/encoding';
import { assert } from '@cosmjs/utils';
import test from 'ava';

import { Link, testutils } from '..';
const { gaia, ics20, setup, setupWasmClient, wasmd } = testutils;

// TODO: replace these with be auto-generated helpers from ts-codegen
import { balance, init, sendTokens } from './cw20';
import { setupContracts } from './utils';

let codeIds: Record<string, number> = {};

test.before(async (t) => {
  const contracts = {
    cw20: 'cw20_base.wasm',
    ics20: 'cw20_ics20.wasm',
  };
  codeIds = await setupContracts(contracts);
  t.pass();
});

test.serial('set up channel with ics20 contract', async (t) => {
  const cosmwasm = await setupWasmClient();

  // instantiate ics20
  const ics20Msg = {
    default_timeout: 3600,
    gov_contract: cosmwasm.senderAddress,
    allowlist: [],
  };
  const { contractAddress: ics20Addr } = await cosmwasm.sign.instantiate(
    cosmwasm.senderAddress,
    codeIds.ics20,
    ics20Msg,
    'ICS',
    'auto'
  );
  t.truthy(ics20Addr);

  const { ibcPortId: wasmPort } = await cosmwasm.sign.getContract(ics20Addr);
  console.log(`Ibc Port: ${wasmPort}`);
  assert(wasmPort);

  const [src, dest] = await setup(gaia, wasmd);
  const link = await Link.createWithNewConnections(src, dest);
  await link.createChannel(
    'A',
    gaia.ics20Port,
    wasmPort,
    ics20.ordering,
    ics20.version
  );
});

test.serial('send packets with ics20 contract', async (t) => {
  const cosmwasm = await setupWasmClient();

  // instantiate cw20
  const initMsg = init(cosmwasm.senderAddress, 'CASH', '123456789000');
  const { contractAddress: cw20Addr } = await cosmwasm.sign.instantiate(
    cosmwasm.senderAddress,
    codeIds.cw20,
    initMsg,
    'CASH',
    'auto'
  );
  t.truthy(cw20Addr);
  let bal = await balance(cosmwasm, cw20Addr);
  t.is('123456789000', bal);

  // instantiate ics20
  const ics20Msg = {
    default_timeout: 3600,
    gov_contract: cosmwasm.senderAddress,
    allowlist: [
      {
        contract: cw20Addr,
        gas_limit: 250000,
      },
    ],
  };
  const { contractAddress: ics20Addr } = await cosmwasm.sign.instantiate(
    cosmwasm.senderAddress,
    codeIds.ics20,
    ics20Msg,
    'ICSX',
    'auto'
  );
  t.truthy(ics20Addr);

  const { ibcPortId: wasmPort } = await cosmwasm.sign.getContract(ics20Addr);
  console.log(`Ibc Port: ${wasmPort}`);
  assert(wasmPort);

  const [src, dest] = await setup(gaia, wasmd);
  const link = await Link.createWithNewConnections(src, dest);
  const channels = await link.createChannel(
    'A',
    gaia.ics20Port,
    wasmPort,
    ics20.ordering,
    ics20.version
  );

  // send a packet from the ics20 contract.... (on dest chain)
  const sendMsg = sendTokens(ics20Addr, '456789000', {
    channel: channels.dest.channelId,
    remote_address: src.senderAddress,
  });
  await cosmwasm.sign.execute(
    cosmwasm.senderAddress,
    cw20Addr,
    sendMsg,
    'auto',
    'Send CW20 tokens via ICS20'
  );

  // let's see if the balance went down
  bal = await balance(cosmwasm, cw20Addr);
  t.is('123000000000', bal);

  // check source balance
  const preBalance = await src.sign.getAllBalances(src.senderAddress);
  t.is(1, preBalance.length);
  t.is('uatom', preBalance[0].denom);

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
  const ibcCoin = relayedBalance.find((d) => d.denom !== 'uatom');
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
    denom: 'uatom',
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
