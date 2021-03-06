/*
This file is designed to be run to fund accounts and send packets when manually
testing ibc-setup and ibc-relayer on localhost.

Please configure the global variables to match the accounts displayed by
`ibc-setup keys list` before running.

Execute via:

yarn build && yarn test:unit ./src/lib/manual/fund-relayer.spec.ts
*/

import test from 'ava';

import { fundAccount, simapp, wasmd } from '../testutils';

import { simappAddress, wasmdAddress } from './consts';

test.serial('fund relayer', async (t) => {
  await fundAccount(simapp, simappAddress, '50000000');
  await fundAccount(wasmd, wasmdAddress, '50000000');

  // to make ava happy
  t.is(1, 1);
});
