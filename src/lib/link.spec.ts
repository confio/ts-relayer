import test from 'ava';

import { Link } from './link';
import {
  fundAccount,
  generateMnemonic,
  signingClient,
  simapp,
  wasmd,
} from './testutils.spec';

test.serial('establish new client-connection', async (t) => {
  // create apps and fund an account
  const mnemonic = generateMnemonic();
  const src = await signingClient(simapp, mnemonic);
  const dest = await signingClient(wasmd, mnemonic);
  await fundAccount(wasmd, dest.senderAddress, '100000');
  await fundAccount(simapp, src.senderAddress, '100000');

  const link = await Link.createConnection(src, dest);
  // ensure the data makes sense (TODO: more?)
  t.assert(link.endA.clientID.startsWith('07-tendermint-'), link.endA.clientID);
  t.assert(link.endB.clientID.startsWith('07-tendermint-'), link.endB.clientID);

  // try to update both clients, ensuring this connection is stable
  await link.updateClient('A');
  // TODO: ensure it is updated
  await link.updateClient('B');
  // TODO: ensure it is updated
});
