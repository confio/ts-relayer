import test from 'ava';

import { buildClientState, buildConsensusState } from './ibcclient';
import {
  fundAccount,
  generateMnemonic,
  signingClient,
  simapp,
  sleep,
  wasmd,
} from './testutils.spec';

test.serial('create simapp client on wasmd', async (t) => {
  // create apps and fund an account
  const mnemonic = generateMnemonic();
  const { client: src } = await signingClient(simapp, mnemonic);
  const { address, client: dest } = await signingClient(wasmd, mnemonic);
  await fundAccount(wasmd, address, '100000');

  const preClients = await dest.query.ibc.unverified.clientStates();
  const preLen = preClients.clientStates.length;

  const header = await src.latestHeader();
  const conState = buildConsensusState(header);
  const cliState = buildClientState(
    await src.getChainId(),
    1000,
    500,
    header.height
  );
  const res = await dest.createTendermintClient(address, cliState, conState);
  t.assert(res.clientId.startsWith('07-tendermint-'));

  const postClients = await dest.query.ibc.unverified.clientStates();
  t.is(postClients.clientStates.length, preLen + 1);
});

test.only('update simapp client on wasmd', async (t) => {
  // create apps and fund an account
  const mnemonic = generateMnemonic();
  const { client: src } = await signingClient(simapp, mnemonic);
  const { address, client: dest } = await signingClient(wasmd, mnemonic);
  await fundAccount(wasmd, address, '100000');

  const header = await src.latestHeader();
  const conState = buildConsensusState(header);
  const cliState = buildClientState(
    await src.getChainId(),
    1000,
    500,
    header.height
  );
  const { clientId } = await dest.createTendermintClient(
    address,
    cliState,
    conState
  );
  // TODO: clientState details with this one ID
  const clients = await dest.query.ibc.unverified.clientStates();
  const mine = clients.clientStates.find((c) => c.clientId == clientId);
  t.assert(typeof mine !== 'undefined');
  console.error(mine);

  // wait for a few blocks, then try
  console.error(`created client ${clientId}`);
  await sleep(4000);
  const newHeader = await src.buildHeader(header.height);
  await dest.updateTendermintClient(address, clientId, newHeader);

  // TODO: clientState details with this id, should be higher height
});
