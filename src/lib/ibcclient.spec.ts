import test from "ava";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";

import {
  gaia,
  ics20,
  randomAddress,
  setup,
  TestLogger,
  wasmd,
} from "./helpers";
import { buildCreateClientArgs, prepareConnectionHandshake } from "./ibcclient";
import { Link } from "./link";
import {
  buildClientState,
  buildConsensusState,
  parseAcksFromTxEvents,
  parsePacketsFromEvents,
} from "./utils";

test.serial("create gaia client on wasmd", async (t) => {
  const logger = new TestLogger();
  const [src, dest] = await setup(gaia, wasmd, logger);

  const preClients = await dest.query.ibc.client.allStates();
  const preLen = preClients.clientStates.length;

  const header = await src.latestHeader();

  const conState = buildConsensusState(header);
  const cliState = buildClientState(
    await src.getChainId(),
    1000,
    500,
    src.revisionHeight(header.height),
  );
  const res = await dest.createTendermintClient(cliState, conState);
  t.assert(res.clientId.startsWith("07-tendermint-"));

  await dest.waitOneBlock();
  const postClients = await dest.query.ibc.client.allStates();
  t.is(postClients.clientStates.length, preLen + 1);
});

test.serial("create and update wasmd client on gaia", async (t) => {
  const [src, dest] = await setup(gaia, wasmd);

  const header = await src.latestHeader();

  const conState = buildConsensusState(header);
  const cliState = buildClientState(
    await src.getChainId(),
    1000,
    500,
    src.revisionHeight(header.height),
  );
  const { clientId } = await dest.createTendermintClient(cliState, conState);
  const state = await dest.query.ibc.client.stateTm(clientId);
  // console.error(state);
  // TODO: check more details?
  t.is(Number(state.latestHeight?.revisionHeight), header.height);
  t.deepEqual(state.chainId, await src.getChainId());

  // wait for a few blocks, then try
  for (let i = 0; i < 10; i++) {
    await src.waitOneBlock();
  }
  const newHeader = await src.buildHeader(header.height);
  const newHeight = newHeader.signedHeader?.header?.height;
  t.not(Number(newHeight), header.height);

  await dest.updateTendermintClient(clientId, newHeader);

  // any other checks?
  const upstate = await dest.query.ibc.client.stateTm(clientId);
  t.assert(sameBigInt(upstate.latestHeight?.revisionHeight, newHeight));
});

// handles both as optional fields, does Long.equal to ignore signed/unsigned difference
function sameBigInt(a?: bigint, b?: bigint) {
  if (a === undefined) {
    return false;
  }
  if (b === undefined) {
    return false;
  }
  return a == b;
}

// make 2 clients, and try to establish a connection
test.serial("perform connection handshake", async (t) => {
  const [src, dest] = await setup(gaia, wasmd);

  // client on dest -> src
  const args = await buildCreateClientArgs(src, 5000);
  const { clientId: destClientId } = await dest.createTendermintClient(
    args.clientState,
    args.consensusState,
  );
  t.assert(destClientId.startsWith("07-tendermint-"));

  // client on src -> dest
  const args2 = await buildCreateClientArgs(dest, 5000);
  const { clientId: srcClientId } = await src.createTendermintClient(
    args2.clientState,
    args2.consensusState,
  );
  t.assert(srcClientId.startsWith("07-tendermint-"));

  // connectionInit on src
  const { connectionId: srcConnId } = await src.connOpenInit(
    srcClientId,
    destClientId,
  );
  t.assert(srcConnId.startsWith("connection-"), srcConnId);

  // connectionTry on dest
  const proof = await prepareConnectionHandshake(
    src,
    dest,
    srcClientId,
    destClientId,
    srcConnId,
  );
  // now post and hope it is accepted
  const { connectionId: destConnId } = await dest.connOpenTry(
    destClientId,
    proof,
  );
  t.assert(destConnId.startsWith("connection-"), destConnId);

  // connectionAck on src
  const proofAck = await prepareConnectionHandshake(
    dest,
    src,
    destClientId,
    srcClientId,
    destConnId,
  );
  await src.connOpenAck(srcConnId, proofAck);

  // connectionConfirm on dest
  const proofConfirm = await prepareConnectionHandshake(
    src,
    dest,
    srcClientId,
    destClientId,
    srcConnId,
  );
  await dest.connOpenConfirm(destConnId, proofConfirm);
});

test.serial("transfer message and send packets", async (t) => {
  const logger = new TestLogger();
  // set up ics20 channel
  const [nodeA, nodeB] = await setup(gaia, wasmd);
  const link = await Link.createWithNewConnections(nodeA, nodeB, logger);
  const channels = await link.createChannel(
    "A",
    gaia.ics20Port,
    wasmd.ics20Port,
    ics20.ordering,
    ics20.version,
  );
  t.is(channels.src.portId, gaia.ics20Port);

  // make an account on remote chain, and check it is empty
  const recipient = randomAddress(wasmd.prefix);
  const preBalance = await nodeB.query.bank.allBalances(recipient);
  t.is(preBalance.length, 0);

  // submit a transfer message
  const destHeight = await nodeB.timeoutHeight(500); // valid for 500 blocks
  const token = { amount: "12345", denom: gaia.denomFee };
  const transferResult = await nodeA.transferTokens(
    channels.src.portId,
    channels.src.channelId,
    token,
    recipient,
    destHeight,
  );

  const packets = parsePacketsFromEvents(transferResult.events);
  t.is(packets.length, 1);
  const packet = packets[0];

  // base the proof sequence on prepareChannelHandshake
  // update client on dest
  await nodeA.waitOneBlock();
  const headerHeight = await nodeB.doUpdateClient(link.endB.clientID, nodeA);
  const proof = await nodeA.getPacketProof(packet, headerHeight);

  const relayResult = await nodeB.receivePacket(packet, proof, headerHeight);

  // query balance of recipient (should be "12345" or some odd hash...)
  const postBalance = await nodeB.query.bank.allBalances(recipient);
  t.is(postBalance.length, 1);
  const recvCoin = postBalance[0];
  t.is(recvCoin.amount, "12345");
  t.assert(recvCoin.denom.startsWith("ibc/"), recvCoin.denom);

  // get the acknowledgement from the receivePacket tx
  const acks = parseAcksFromTxEvents(relayResult.events);
  t.is(acks.length, 1);
  const ack = acks[0];

  // get an ack proof and return to node A
  await nodeB.waitOneBlock();
  const ackHeaderHeight = await nodeA.doUpdateClient(link.endA.clientID, nodeB);
  const ackProof = await nodeB.getAckProof(ack, ackHeaderHeight);
  await nodeA.acknowledgePacket(ack, ackProof, ackHeaderHeight);
  // Do we need to check the result? or just see the tx succeeded?
});

test.serial("tests parsing with multi-message", async (t) => {
  const logger = new TestLogger();
  // set up ics20 channel
  const [nodeA, nodeB] = await setup(gaia, wasmd, logger);
  const link = await Link.createWithNewConnections(nodeA, nodeB, logger);
  const channels = await link.createChannel(
    "A",
    gaia.ics20Port,
    wasmd.ics20Port,
    ics20.ordering,
    ics20.version,
  );

  // make an account on remote chain for testing
  const destAddr = randomAddress(wasmd.prefix);
  const srcAddr = randomAddress(gaia.prefix);

  // submit a send message - no events
  const { events: sendEvents } = await nodeA.sendTokens(srcAddr, [
    { amount: "5000", denom: gaia.denomFee },
  ]);
  t.assert(
    logger.verbose.calledWithMatch(/Send tokens to/),
    logger.verbose.callCount.toString(),
  );
  t.assert(
    logger.debug.calledWithMatch(/Send tokens:/),
    logger.debug.callCount.toString(),
  );

  const sendPackets = parsePacketsFromEvents(sendEvents);
  t.is(sendPackets.length, 0);

  const sendAcks = parseAcksFromTxEvents(sendEvents);
  t.is(sendAcks.length, 0);

  // submit 2 transfer messages
  const timeoutHeight = await nodeB.timeoutHeight(500);
  const msg = {
    typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
    value: MsgTransfer.fromPartial({
      sourcePort: channels.src.portId,
      sourceChannel: channels.src.channelId,
      sender: nodeA.senderAddress,
      token: { amount: "6000", denom: gaia.denomFee },
      receiver: destAddr,
      timeoutHeight,
    }),
  };
  const msg2 = {
    typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
    value: MsgTransfer.fromPartial({
      sourcePort: channels.src.portId,
      sourceChannel: channels.src.channelId,
      sender: nodeA.senderAddress,
      token: { amount: "9000", denom: gaia.denomFee },
      receiver: destAddr,
      timeoutHeight,
    }),
  };
  const { events: multiEvents } = await nodeA.sendMultiMsg([msg, msg2]);
  const multiPackets = parsePacketsFromEvents(multiEvents);
  t.is(multiPackets.length, 2);
  // no acks here
  const multiAcks = parseAcksFromTxEvents(multiEvents);
  t.is(multiAcks.length, 0);

  // post them to the other side
  await nodeA.waitOneBlock();
  const headerHeight = await nodeB.doUpdateClient(link.endB.clientID, nodeA);
  const proofs = await Promise.all(
    multiPackets.map((packet) => nodeA.getPacketProof(packet, headerHeight)),
  );
  const { events: relayEvents } = await nodeB.receivePackets(
    multiPackets,
    proofs,
    headerHeight,
  );

  // no recv packets here
  const relayPackets = parsePacketsFromEvents(relayEvents);
  t.is(relayPackets.length, 0);
  // but we got 2 acks
  const relayAcks = parseAcksFromTxEvents(relayEvents);
  t.is(relayAcks.length, 2);

  // relay them together
  await nodeB.waitOneBlock();
  const ackHeaderHeight = await nodeA.doUpdateClient(link.endA.clientID, nodeB);
  const ackProofs = await Promise.all(
    relayAcks.map((ack) => nodeB.getAckProof(ack, ackHeaderHeight)),
  );
  await nodeA.acknowledgePackets(relayAcks, ackProofs, ackHeaderHeight);
});
