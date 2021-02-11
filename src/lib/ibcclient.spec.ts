import { sleep } from '@cosmjs/utils';
import test from 'ava';

import {
  buildClientState,
  buildConsensusState,
  buildCreateClientArgs,
} from './ibcclient';
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

test.serial('create and update wasmd client on simapp', async (t) => {
  // create apps and fund an account
  const mnemonic = generateMnemonic();
  const { client: src } = await signingClient(wasmd, mnemonic);
  const { address, client: dest } = await signingClient(simapp, mnemonic);
  await fundAccount(simapp, address, '100000');

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
  const state = await dest.query.ibc.unverified.clientStateTm(clientId);
  console.error(state);
  // TODO: check more details?
  t.is(state.latestHeight?.revisionHeight.toNumber(), header.height);

  // wait for a few blocks, then try
  console.error(`created client ${clientId}`);
  await sleep(1000);
  const newHeader = await src.buildHeader(header.height);
  const newHeight = newHeader.signedHeader?.header?.height;
  t.not(newHeight?.toNumber(), header.height);
  await dest.updateTendermintClient(address, clientId, newHeader);

  // any other checks?
  const upstate = await dest.query.ibc.unverified.clientStateTm(clientId);
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

// make 2 clients, and try to establish a connection
test.serial('start connection handshake', async (t) => {
  // create apps and fund an account
  const mnemonic = generateMnemonic();
  const { address: srcAddress, client: src } = await signingClient(
    simapp,
    mnemonic
  );
  const { address: destAddress, client: dest } = await signingClient(
    wasmd,
    mnemonic
  );
  await fundAccount(wasmd, destAddress, '100000');
  await fundAccount(simapp, srcAddress, '100000');

  // client on dest -> src
  const args = await buildCreateClientArgs(src, 1000, 500);
  const { clientId: destClientId } = await dest.createTendermintClient(
    destAddress,
    args.clientState,
    args.consensusState
  );
  t.assert(destClientId.startsWith('07-tendermint-'));

  // client on src -> dest
  const args2 = await buildCreateClientArgs(dest, 1000, 500);
  const { clientId: srcClientId } = await src.createTendermintClient(
    srcAddress,
    args2.clientState,
    args2.consensusState
  );
  t.assert(srcClientId.startsWith('07-tendermint-'));

  // getConnectionProof (TODO: much more)
  const proof = await src.getConnectionProof(srcClientId, '');
  console.error(proof);
  t.is(srcClientId, proof.clientId);
});
