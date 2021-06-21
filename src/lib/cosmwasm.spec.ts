import { toBase64, toUtf8 } from '@cosmjs/encoding';
import test from 'ava';

import { Link } from './link';
import { CosmWasmSigner, ics20, setup, setupWasmClient } from './testutils';

const codeIds = {
  cw20: 1,
  ics20: 2,
};

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
  cw20Addr: string
): Promise<string> {
  const query = {
    balance: {
      address: cosmwasm.senderAddress,
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

  // ensure the packet moves
  const packets = await link.getPendingPackets('B');
  t.is(packets.length, 1);
  const preAcks = await link.getPendingAcks('A');
  t.is(preAcks.length, 0);
  // move it and the ack
  const txAcks = await link.relayPackets('B', packets);
  t.is(txAcks.length, 1);
  // need to wait briefly for it to be indexed
  await src.waitOneBlock();
  // and send the acks over
  await link.relayAcks('A', txAcks);

  // TODO: before and after of all balances on source
});
