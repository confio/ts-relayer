// This file outputs some basic test functionality, and includes tests that they work
import test from 'ava';

import {
  fundAccount,
  gaia,
  generateMnemonic,
  signingClient,
  TestLogger,
} from './testutils';

test.serial('try to setup gaia', async (t) => {
  const logger = new TestLogger();
  // create apps and fund an account
  const mnemonic = generateMnemonic();
  const src = await signingClient(gaia, mnemonic, logger);
  await fundAccount(gaia, src.senderAddress, '600000');

  const balance = await src.query.bank.allBalances(src.senderAddress);
  t.deepEqual(balance, [{ amount: '600000', denom: 'uatom' }]);

  const unused = await src.query.bank.allBalances(gaia.unused.address);
  t.deepEqual(unused, [{ amount: gaia.unused.balanceStaking, denom: 'uatom' }]);
});
