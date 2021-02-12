import { sleep } from '@cosmjs/utils';
import test from 'ava';

import {
  buildClientState,
  buildConsensusState,
  buildCreateClientArgs,
  toIntHeight,
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

  const preClients = await dest.query.ibc.client.states();
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

  const postClients = await dest.query.ibc.client.states();
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
  const state = await dest.query.ibc.client.stateTm(clientId);
  // console.error(state);
  // TODO: check more details?
  t.is(state.latestHeight?.revisionHeight.toNumber(), header.height);
  t.deepEqual(state.chainId, await src.getChainId());

  // wait for a few blocks, then try
  await sleep(1000);
  const newHeader = await src.buildHeader(header.height);
  const newHeight = newHeader.signedHeader?.header?.height;
  t.not(newHeight?.toNumber(), header.height);
  await dest.updateTendermintClient(address, clientId, newHeader);

  // any other checks?
  const upstate = await dest.query.ibc.client.stateTm(clientId);
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
test.only('start connection handshake', async (t) => {
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
  // Note: unbonding time (first parameter is checked against the actual keeper - must use real values from genesis.json)
  const args = await buildCreateClientArgs(src, 1814400, 5000);
  const { clientId: destClientId } = await dest.createTendermintClient(
    destAddress,
    args.clientState,
    args.consensusState
  );
  t.assert(destClientId.startsWith('07-tendermint-'));

  // client on src -> dest
  const args2 = await buildCreateClientArgs(dest, 1814400, 5000);
  const { clientId: srcClientId } = await src.createTendermintClient(
    srcAddress,
    args2.clientState,
    args2.consensusState
  );
  t.assert(srcClientId.startsWith('07-tendermint-'));

  // connectionInit on src
  const { connectionId: srcConnId } = await src.connOpenInit(
    srcAddress,
    srcClientId,
    destClientId
  );
  t.assert(srcConnId.startsWith('connection-'), srcConnId);

  // connectionTry on dest - many steps

  // first, get a header that can prove connOpenInit and update dest Client
  await src.waitOneBlock();
  // update client on dest
  // TODO: extract to a function
  const { latestHeight } = await dest.query.ibc.client.stateTm(destClientId);
  const tryProofHeader = await src.buildHeader(toIntHeight(latestHeight));
  await dest.updateTendermintClient(destAddress, destClientId, tryProofHeader);
  // const updatedHeight =
  //   tryProofHeader.signedHeader?.header?.height?.toNumber() ?? 0;

  // get a proof (for the proven height)
  const proof = await src.getConnectionProof(srcClientId, srcConnId);
  // now post and hope it is accepted
  const { connectionId: destConnId } = await dest.connOpenTry(
    destAddress,
    destClientId,
    proof
  );
  t.assert(destConnId.startsWith('connection-'), destConnId);
});
