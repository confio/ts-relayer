import { sleep } from '@cosmjs/utils';
import test from 'ava';

import {
  buildClientState,
  buildConsensusState,
  buildCreateClientArgs,
  prepareConnHandshake,
} from './ibcclient';
import { setup } from './testutils.spec';

test.serial('create simapp client on wasmd', async (t) => {
  const [src, dest] = await setup();

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
  const res = await dest.createTendermintClient(cliState, conState);
  t.assert(res.clientId.startsWith('07-tendermint-'));

  await dest.waitOneBlock();
  const postClients = await dest.query.ibc.client.states();
  t.is(postClients.clientStates.length, preLen + 1);
});

test.serial('create and update wasmd client on simapp', async (t) => {
  const [src, dest] = await setup();

  const header = await src.latestHeader();
  const conState = buildConsensusState(header);
  const cliState = buildClientState(
    await src.getChainId(),
    1000,
    500,
    header.height
  );
  const { clientId } = await dest.createTendermintClient(cliState, conState);
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
  await dest.updateTendermintClient(clientId, newHeader);

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
test.only('perform connection handshake', async (t) => {
  const [src, dest] = await setup();

  // client on dest -> src
  const args = await buildCreateClientArgs(src, genesisUnbondingTime, 5000);
  const { clientId: destClientId } = await dest.createTendermintClient(
    args.clientState,
    args.consensusState
  );
  t.assert(destClientId.startsWith('07-tendermint-'));

  // client on src -> dest
  const args2 = await buildCreateClientArgs(dest, genesisUnbondingTime, 5000);
  const { clientId: srcClientId } = await src.createTendermintClient(
    args2.clientState,
    args2.consensusState
  );
  t.assert(srcClientId.startsWith('07-tendermint-'));

  // connectionInit on src
  const { connectionId: srcConnId } = await src.connOpenInit(
    srcClientId,
    destClientId
  );
  t.assert(srcConnId.startsWith('connection-'), srcConnId);

  // connectionTry on dest
  const proof = await prepareConnHandshake(
    src,
    dest,
    srcClientId,
    destClientId,
    srcConnId
  );
  // now post and hope it is accepted
  const { connectionId: destConnId } = await dest.connOpenTry(
    destClientId,
    proof
  );
  t.assert(destConnId.startsWith('connection-'), destConnId);

  // connectionAck on src
  const proofAck = await prepareConnHandshake(
    dest,
    src,
    destClientId,
    srcClientId,
    destConnId
  );
  await src.connOpenAck(srcConnId, proofAck);

  // connectionConfirm on dest
  const proofConfirm = await prepareConnHandshake(
    src,
    dest,
    srcClientId,
    destClientId,
    srcConnId
  );
  await dest.connOpenConfirm(proofConfirm);
});
