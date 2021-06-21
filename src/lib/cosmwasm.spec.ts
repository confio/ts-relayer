import test from 'ava';

import { Link } from './link';
import { ics20, setup, setupWasmClient } from './testutils';

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
