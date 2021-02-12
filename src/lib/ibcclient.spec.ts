import { sleep } from '@cosmjs/utils';
import test from 'ava';

import { buildClientState, buildConsensusState } from './ibcclient';
import {
  fundAccount,
  generateMnemonic,
  signingClient,
  simapp,
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

test.serial('update simapp client on wasmd', async (t) => {
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
  const state = await dest.query.ibc.unverified.clientState(clientId);
  // TODO: check more details?
  t.is(state.latestHeight?.revisionHeight.toNumber(), header.height);

  // wait for a few blocks, then try
  await sleep(1500);
  const newHeader = await src.buildHeader(header.height);
  const newHeight = newHeader.signedHeader?.header?.height;
  t.not(newHeight?.toNumber(), header.height);
  await dest.updateTendermintClient(address, clientId, newHeader);

  // any other checks?
  const upstate = await dest.query.ibc.unverified.clientState(clientId);
  t.assert(sameLong(upstate.latestHeight?.revisionHeight, newHeight));
});

// handles both as optional fields, does Long.equal to ignore signed/unsigned difference
function sameLong(a?: Long, b?: Long) {
  if (a === undefined) {
    return false;
  }
  if (b === undefined) {
    return false;
  }
  return a.equals(b);
}
