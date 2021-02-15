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

// measured in seconds
// Note: client parameter is checked against the actual keeper - must use real values from genesis.json
const genesisUnbondingTime = 1814400;

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
  const args = await buildCreateClientArgs(src, genesisUnbondingTime, 5000);
  const { clientId: destClientId } = await dest.createTendermintClient(
    destAddress,
    args.clientState,
    args.consensusState
  );
  t.assert(destClientId.startsWith('07-tendermint-'));
  const state1 = await dest.query.ibc.client.stateTm(destClientId);
  console.error(
    `Init dest height: ${state1.latestHeight?.revisionHeight.toNumber()}`
  );

  // client on src -> dest
  const args2 = await buildCreateClientArgs(dest, genesisUnbondingTime, 5000);
  const { clientId: srcClientId } = await src.createTendermintClient(
    srcAddress,
    args2.clientState,
    args2.consensusState
  );
  t.assert(srcClientId.startsWith('07-tendermint-'));
  const state2 = await src.query.ibc.client.stateTm(srcClientId);
  console.error(
    `Init src height: ${state2.latestHeight?.revisionHeight.toNumber()}`
  );

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
  const headerHeight = await dest.doUpdateClient(
    destAddress,
    destClientId,
    src
  );
  console.error(`updateDest msg height: ${headerHeight}`);
  const state3 = await dest.query.ibc.client.stateTm(destClientId);
  console.error(
    `updateDest state height: ${state3.latestHeight?.revisionHeight.toNumber()}`
  );

  // get a proof (for the proven height)
  const proof = await src.getConnectionProof(
    srcClientId,
    srcConnId,
    headerHeight
  );
  // now post and hope it is accepted
  const { connectionId: destConnId } = await dest.connOpenTry(
    destAddress,
    destClientId,
    proof
  );
  t.assert(destConnId.startsWith('connection-'), destConnId);

  // connectionAck on src - many steps

  // first, get a header that can prove connOpenTry and update src Client
  await dest.waitOneBlock();
  // update client on dest
  const headerHeightAck = await src.doUpdateClient(
    srcAddress,
    srcClientId,
    dest
  );
  console.error(`updateSrc msg height: ${headerHeightAck}`);
  const state4 = await src.query.ibc.client.stateTm(srcClientId);
  console.error(
    `updateSrc state height: ${state4.latestHeight?.revisionHeight.toNumber()}`
  );

  // get a proof (for the proven height)
  const proofAck = await dest.getConnectionProof(
    destClientId,
    destConnId,
    headerHeightAck
  );
  // now post and hope it is accepted
  await src.connOpenAck(srcAddress, srcConnId, proofAck);

  // connectionConfirm on dest - many steps

  // first, get a header that can prove connOpenInit and update dest Client
  await src.waitOneBlock();
  // update client on dest
  const headerHeightConfirm = await dest.doUpdateClient(
    destAddress,
    destClientId,
    src
  );
  // get a proof (for the proven height)
  const proofConfirm = await src.getConnectionProof(
    srcClientId,
    srcConnId,
    headerHeightConfirm
  );
  // now post and hope it is accepted
  await dest.connOpenConfirm(destAddress, proofConfirm);
});
