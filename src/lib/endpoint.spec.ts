import test from "ava";

import { gaia, ics20, randomAddress, setup, wasmd } from "./helpers";
import { Link } from "./link";
import { parseAcksFromTxEvents } from "./utils";

test.serial("submit multiple tx, query all packets", async (t) => {
  // setup a channel
  const [nodeA, nodeB] = await setup(gaia, wasmd);
  const link = await Link.createWithNewConnections(nodeA, nodeB);
  const channels = await link.createChannel(
    "A",
    gaia.ics20Port,
    wasmd.ics20Port,
    ics20.ordering,
    ics20.version,
  );

  // no packets here
  const packets1 = await link.endA.querySentPackets();
  t.is(packets1.length, 0);

  // some basic setup for the transfers
  const recipient = randomAddress(wasmd.prefix);
  const destHeight = await nodeB.timeoutHeight(500); // valid for 500 blocks
  const amounts = [1000, 2222, 3456];
  // const totalSent = amounts.reduce((a, b) => a + b, 0);

  // let's make 3 transfer tx at different heights
  const txHeights = [];
  for (const amount of amounts) {
    const token = { amount: amount.toString(), denom: gaia.denomFee };
    const { height } = await nodeA.transferTokens(
      channels.src.portId,
      channels.src.channelId,
      token,
      recipient,
      destHeight,
    );
    // console.log(JSON.stringify(logs[0].events, undefined, 2));
    txHeights.push(height);
  }
  // ensure these are different
  t.assert(txHeights[1] > txHeights[0], txHeights.toString());
  t.assert(txHeights[2] > txHeights[1], txHeights.toString());
  // wait for this to get indexed
  await nodeA.waitOneBlock();

  // now query for all packets
  const packets2 = await link.endA.querySentPackets();
  t.is(packets2.length, 3);
  t.deepEqual(
    packets2.map(({ height }) => height),
    txHeights,
  );

  // filter by minimum height
  const packets3 = await link.endA.querySentPackets({
    minHeight: txHeights[1],
  });
  t.is(packets3.length, 2);
  const packets4 = await link.endA.querySentPackets({
    minHeight: txHeights[2] + 1,
  });
  t.is(packets4.length, 0);

  // filter by maximum height
  const packets5 = await link.endA.querySentPackets({
    maxHeight: txHeights[1],
  });
  t.is(packets5.length, 2);
  const packets6 = await link.endA.querySentPackets({
    minHeight: txHeights[1],
    maxHeight: txHeights[1],
  });
  t.is(packets6.length, 1);

  // ensure no acks on either chain
  const acksA1 = await link.endA.queryWrittenAcks();
  t.is(acksA1.length, 0);
  const acksB1 = await link.endB.queryWrittenAcks();
  t.is(acksB1.length, 0);

  // relay 2 packets to the other side
  await nodeA.waitOneBlock();
  const headerHeight = await nodeB.doUpdateClient(link.endB.clientID, nodeA);
  const sendPackets = packets3.map(({ packet }) => packet);
  const proofs = await Promise.all(
    sendPackets.map((packet) => nodeA.getPacketProof(packet, headerHeight)),
  );
  const { events: relayEvents } = await nodeB.receivePackets(
    sendPackets,
    proofs,
    headerHeight,
  );
  const txAcks = parseAcksFromTxEvents(relayEvents);
  t.is(txAcks.length, 2);
  // do we always need to sleep for the indexer?
  await link.endB.client.waitForIndexer();

  // check that acks can be queried on B (and not A)
  const acksA2 = await link.endA.queryWrittenAcks();
  t.is(acksA2.length, 0);
  const acksB2 = await link.endB.queryWrittenAcks();
  t.is(acksB2.length, 2);
});
