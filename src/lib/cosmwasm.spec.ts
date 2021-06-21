import test from 'ava';

import { setupWasmClient } from './testutils';

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
