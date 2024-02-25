import { assert } from "@cosmjs/utils";
import test from "ava";
import { State } from "cosmjs-types/ibc/core/channel/v1/channel";

import {
  gaia,
  ics20,
  randomAddress,
  setup,
  TestLogger,
  transferTokens,
  wasmd,
} from "./helpers";
import { prepareChannelHandshake } from "./ibcclient";
import { Link, RelayedHeights } from "./link";
import { secondsFromDateNanos, splitPendingPackets } from "./utils";

test.serial("establish new client-connection", async (t) => {
  const logger = new TestLogger();
  const [src, dest] = await setup(gaia, wasmd);

  const link = await Link.createWithNewConnections(src, dest, logger);
  // ensure the data makes sense (TODO: more?)
  t.assert(link.endA.clientID.startsWith("07-tendermint-"), link.endA.clientID);
  t.assert(link.endB.clientID.startsWith("07-tendermint-"), link.endB.clientID);

  // try to update both clients, ensuring this connection is stable
  await link.updateClient("A");
  // TODO: ensure it is updated
  await link.updateClient("B");
  // TODO: ensure it is updated

  t.assert(logger.info.calledTwice, logger.info.callCount.toString());
});

test.serial("initialized connection and start channel handshake", async (t) => {
  const [src, dest] = await setup(gaia, wasmd);
  const link = await Link.createWithNewConnections(src, dest);

  // reject channels with invalid ports
  await t.throwsAsync(() =>
    src.channelOpenInit(
      wasmd.ics20Port,
      wasmd.ics20Port,
      ics20.ordering,
      link.endA.connectionID,
      ics20.version,
    ),
  );
  // we need to wait a block for a new checkTx state, and proper sequences
  await src.waitOneBlock();

  // reject channels with invalid version
  await t.throwsAsync(() =>
    src.channelOpenInit(
      gaia.ics20Port,
      wasmd.ics20Port,
      ics20.ordering,
      link.endA.connectionID,
      "ics27",
    ),
  );
  // we need to wait a block for a new checkTx state, and proper sequences
  await src.waitOneBlock();

  // this is valid and works
  const { channelId: channelIdSrc } = await src.channelOpenInit(
    gaia.ics20Port,
    wasmd.ics20Port,
    ics20.ordering,
    link.endA.connectionID,
    ics20.version,
  );
  t.assert(channelIdSrc.startsWith("channel-"), channelIdSrc);
});

test.serial(
  "automated channel handshake on initialized connection",
  async (t) => {
    const [nodeA, nodeB] = await setup(gaia, wasmd);
    const link = await Link.createWithNewConnections(nodeA, nodeB);

    // increment the channel sequence on src, to guarantee unique ids
    await nodeA.channelOpenInit(
      gaia.ics20Port,
      wasmd.ics20Port,
      ics20.ordering,
      link.endA.connectionID,
      ics20.version,
    );

    // open a channel
    const channels = await link.createChannel(
      "A",
      gaia.ics20Port,
      wasmd.ics20Port,
      ics20.ordering,
      ics20.version,
    );

    // ensure we bound expected ports
    t.is(channels.src.portId, gaia.ics20Port);
    t.is(channels.dest.portId, wasmd.ics20Port);
    // and have different channel ids (this depends on the increment above)
    t.not(channels.src.channelId, channels.dest.channelId);

    // query data
    const { channel } = await link.endB.client.query.ibc.channel.channel(
      wasmd.ics20Port,
      channels.dest.channelId,
    );
    t.is(channel?.state, State.STATE_OPEN);
    t.is(channel?.ordering, ics20.ordering);
    t.is(channel?.counterparty?.channelId, channels.src.channelId);
  },
);

// createWithExistingConnections

test.serial("reuse existing connections", async (t) => {
  const [src, dest] = await setup(gaia, wasmd);

  const oldLink = await Link.createWithNewConnections(src, dest);
  const connA = oldLink.endA.connectionID;
  const connB = oldLink.endB.connectionID;

  const oldChannels = await oldLink.createChannel(
    "A",
    gaia.ics20Port,
    wasmd.ics20Port,
    ics20.ordering,
    ics20.version,
  );

  const newLink = await Link.createWithExistingConnections(
    src,
    dest,
    connA,
    connB,
  );

  const channelSrc = await newLink.endA.client.query.ibc.channel.channel(
    gaia.ics20Port,
    oldChannels.src.channelId,
  );
  t.is(channelSrc.channel?.state, State.STATE_OPEN);
  t.is(channelSrc.channel?.ordering, ics20.ordering);
  t.is(channelSrc.channel?.counterparty?.channelId, oldChannels.dest.channelId);
  const channelDest = await newLink.endB.client.query.ibc.channel.channel(
    wasmd.ics20Port,
    oldChannels.dest.channelId,
  );
  t.is(channelDest.channel?.state, State.STATE_OPEN);
  t.is(channelDest.channel?.ordering, ics20.ordering);
  t.is(channelDest.channel?.counterparty?.channelId, oldChannels.src.channelId);

  // Check everything is fine by creating a new channel
  // switch src and dest just to test another path
  const newChannels = await newLink.createChannel(
    "B",
    wasmd.ics20Port,
    gaia.ics20Port,
    ics20.ordering,
    ics20.version,
  );
  t.notDeepEqual(newChannels.dest, oldChannels.src);
});

test.serial(
  "reuse existing connections with partially open channel",
  async (t) => {
    const [src, dest] = await setup(gaia, wasmd);

    const oldLink = await Link.createWithNewConnections(src, dest);
    const connA = oldLink.endA.connectionID;
    const connB = oldLink.endB.connectionID;

    const { channelId: srcChannelId } = await src.channelOpenInit(
      gaia.ics20Port,
      wasmd.ics20Port,
      ics20.ordering,
      connA,
      ics20.version,
    );
    const proof = await prepareChannelHandshake(
      src,
      dest,
      oldLink.endB.clientID,
      gaia.ics20Port,
      srcChannelId,
    );
    const { channelId: destChannelId } = await dest.channelOpenTry(
      wasmd.ics20Port,
      { portId: gaia.ics20Port, channelId: srcChannelId },
      ics20.ordering,
      connB,
      ics20.version,
      ics20.version,
      proof,
    );

    const newLink = await Link.createWithExistingConnections(
      src,
      dest,
      connA,
      connB,
    );
    const channelSrc = await newLink.endA.client.query.ibc.channel.channel(
      gaia.ics20Port,
      srcChannelId,
    );
    t.is(channelSrc.channel?.state, State.STATE_INIT);
    t.is(channelSrc.channel?.ordering, ics20.ordering);
    // Counterparty channel ID not yet known
    t.is(channelSrc.channel?.counterparty?.channelId, "");
    const channelDest = await newLink.endB.client.query.ibc.channel.channel(
      wasmd.ics20Port,
      destChannelId,
    );
    t.is(channelDest.channel?.state, State.STATE_TRYOPEN);
    t.is(channelDest.channel?.ordering, ics20.ordering);
    t.is(channelDest.channel?.counterparty?.channelId, srcChannelId);

    // Check everything is fine by creating a new channel
    // switch src and dest just to test another path
    const newChannels = await newLink.createChannel(
      "B",
      wasmd.ics20Port,
      gaia.ics20Port,
      ics20.ordering,
      ics20.version,
    );
    t.notDeepEqual(newChannels.dest, {
      portId: gaia.ics20Port,
      channelId: srcChannelId,
    });
  },
);

test.serial("errors when reusing an invalid connection", async (t) => {
  const [src, dest] = await setup(gaia, wasmd);

  // Make sure valid connections do exist
  await Link.createWithNewConnections(src, dest);

  const connA = "whatever";
  const connB = "unreal";
  await t.throwsAsync(() =>
    Link.createWithExistingConnections(src, dest, connA, connB),
  );
});

test.serial(`errors when reusing connections on the same node`, async (t) => {
  const [src, dest] = await setup(gaia, wasmd);

  const oldLink = await Link.createWithNewConnections(src, dest);
  const connA = oldLink.endA.connectionID;

  await t.throwsAsync(() =>
    Link.createWithExistingConnections(src, src, connA, connA),
  );
});

test.serial(`errors when reusing connections which don’t match`, async (t) => {
  const [src, dest] = await setup(gaia, wasmd);

  const oldLink1 = await Link.createWithNewConnections(src, dest);
  const connA = oldLink1.endA.connectionID;
  const oldLink2 = await Link.createWithNewConnections(src, dest);
  const connB = oldLink2.endB.connectionID;

  await t.throwsAsync(() =>
    Link.createWithExistingConnections(src, dest, connA, connB),
  );
});

test.serial("submit multiple tx, get unreceived packets", async (t) => {
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
  const noPackets = await link.endA.querySentPackets();
  t.is(noPackets.length, 0);

  // let's make 3 transfer tx at different heights
  const amounts = [1000, 2222, 3456];
  const txHeights = await transferTokens(
    nodeA,
    gaia.denomFee,
    nodeB,
    wasmd.prefix,
    channels.src,
    amounts,
  );
  // ensure these are different
  t.assert(txHeights[1] > txHeights[0], txHeights.toString());
  t.assert(txHeights[2] > txHeights[1], txHeights.toString());
  // need to wait briefly for it to be indexed
  await nodeA.waitOneBlock();

  // now query for all packets
  const packets = await link.getPendingPackets("A");
  t.is(packets.length, 3);
  t.deepEqual(
    packets.map(({ height }) => height),
    txHeights,
  );

  // ensure no acks yet
  const preAcks = await link.getPendingAcks("B");
  t.is(preAcks.length, 0);

  // let's pre-update to test conditional logic (no need to update below)
  await nodeA.waitOneBlock();
  await link.updateClient("A");

  // submit 2 of them (out of order)
  const submit = [packets[0], packets[2]];
  const txAcks = await link.relayPackets("A", submit);
  t.is(txAcks.length, 2);
  // need to wait briefly for it to be indexed
  await nodeA.waitOneBlock();

  // ensure only one marked pending (for tx1)
  const postPackets = await link.getPendingPackets("A");
  t.is(postPackets.length, 1);
  t.is(postPackets[0].height, txHeights[1]);

  // ensure acks can be queried
  const acks = await link.getPendingAcks("B");
  t.is(acks.length, 2);

  // submit one of the acks, without waiting (it must update client)
  await link.relayAcks("B", acks.slice(0, 1));

  // ensure only one ack is still pending
  const postAcks = await link.getPendingAcks("B");
  t.is(postAcks.length, 1);
  // and it matches the one we did not send
  t.deepEqual(postAcks[0], acks[1]);
});

test.serial(
  "submit multiple tx on multiple channels, get unreceived packets",
  async (t) => {
    const logger = new TestLogger();
    // setup a channel
    const [nodeA, nodeB] = await setup(gaia, wasmd, logger);
    const link = await Link.createWithNewConnections(nodeA, nodeB, logger);
    const channels1 = await link.createChannel(
      "A",
      gaia.ics20Port,
      wasmd.ics20Port,
      ics20.ordering,
      ics20.version,
    );
    const channels2 = await link.createChannel(
      "A",
      gaia.ics20Port,
      wasmd.ics20Port,
      ics20.ordering,
      ics20.version,
    );
    t.not(channels1.src.channelId, channels2.src.channelId);

    // no packets here
    const noPackets = await link.endA.querySentPackets();
    t.is(noPackets.length, 0);

    // let's make 3 transfer tx at different heights on each channel pair
    const amounts = [1000, 2222, 3456];
    const tx1 = await transferTokens(
      nodeA,
      gaia.denomFee,
      nodeB,
      wasmd.prefix,
      channels1.src,
      amounts,
    );
    const tx2 = await transferTokens(
      nodeA,
      gaia.denomFee,
      nodeB,
      wasmd.prefix,
      channels2.src,
      amounts,
    );
    const txHeights = {
      channels1: tx1.map((height) => ({
        height,
        channelId: channels1.src.channelId,
      })),
      channels2: tx2.map((height) => ({
        height,
        channelId: channels2.src.channelId,
      })),
    };
    // need to wait briefly for it to be indexed
    await nodeA.waitForIndexer();

    // now query for all packets, ensuring we mapped the channels properly
    const packets = await link.getPendingPackets("A");
    t.is(packets.length, 6);
    t.deepEqual(
      packets.map(({ height, packet }) => ({
        height,
        channelId: packet.sourceChannel,
      })),
      [...txHeights.channels1, ...txHeights.channels2],
    );

    // ensure no acks yet
    const preAcks = await link.getPendingAcks("B");
    t.is(preAcks.length, 0);

    // submit 4 of them (out of order) - make sure not to use same sequences on both sides
    const packetsToSubmit = [packets[0], packets[1], packets[4], packets[5]];
    const txAcks = await link.relayPackets("A", packetsToSubmit);
    t.is(txAcks.length, 4);
    await nodeA.waitOneBlock();

    // ensure only two marked pending (for tx1)
    const postPackets = await link.getPendingPackets("A");
    t.is(postPackets.length, 2);
    t.is(postPackets[0].height, txHeights.channels1[2].height);
    t.is(postPackets[1].height, txHeights.channels2[0].height);

    // ensure acks can be queried
    const acks = await link.getPendingAcks("B");
    t.is(acks.length, 4);

    // make sure we ack on different channels (and different sequences)
    t.not(
      acks[0].originalPacket.sourceChannel,
      acks[3].originalPacket.sourceChannel,
    );
    t.not(acks[0].originalPacket.sequence, acks[3].originalPacket.sequence);
    await link.relayAcks("B", [acks[0], acks[3]]);
    await nodeA.waitOneBlock();

    // ensure only two acks are still pending
    const postAcks = await link.getPendingAcks("B");
    t.is(postAcks.length, 2);
    // and it matches the ones we did not send
    t.deepEqual(postAcks[0], acks[1]);
    t.deepEqual(postAcks[1], acks[2]);
  },
);

test.serial(
  "updateClientIfStale only runs if it is too long since an update",
  async (t) => {
    // setup
    const logger = new TestLogger();
    const [nodeA, nodeB] = await setup(gaia, wasmd, logger);
    const link = await Link.createWithNewConnections(nodeA, nodeB, logger);

    // height before waiting
    const heightA = (await nodeA.latestHeader()).height;
    const heightB = (await nodeB.latestHeader()).height;

    // wait a few blocks so we can get stale ones
    for (let i = 0; i < 10; i++) {
      await Promise.all([nodeA.waitOneBlock(), nodeB.waitOneBlock()]);
    }

    // we definitely have updated within the last 1000 seconds, this should do nothing
    const noUpdateA = await link.updateClientIfStale("A", 1000);
    t.is(noUpdateA, null);
    const noUpdateB = await link.updateClientIfStale("B", 1000);
    t.is(noUpdateB, null);

    // we haven't updated in the last 2 seconds, this should trigger the update
    const updateA = await link.updateClientIfStale("A", 2);
    assert(updateA);
    t.assert(Number(updateA.revisionHeight) > heightA);
    const updateB = await link.updateClientIfStale("B", 2);
    assert(updateB);
    t.assert(Number(updateB.revisionHeight) > heightB);
  },
);

test.serial(
  "checkAndRelayPacketsAndAcks relays packets properly",
  async (t) => {
    const logger = new TestLogger();
    const [nodeA, nodeB] = await setup(gaia, wasmd, logger);

    const link = await Link.createWithNewConnections(nodeA, nodeB, logger);
    const channels = await link.createChannel(
      "A",
      gaia.ics20Port,
      wasmd.ics20Port,
      ics20.ordering,
      ics20.version,
    );

    const checkPending = async (
      packA: number,
      packB: number,
      ackA: number,
      ackB: number,
    ) => {
      const packetsA = await link.getPendingPackets("A");
      t.is(packetsA.length, packA);
      const packetsB = await link.getPendingPackets("B");
      t.is(packetsB.length, packB);

      const acksA = await link.getPendingAcks("A");
      t.is(acksA.length, ackA);
      const acksB = await link.getPendingAcks("B");
      t.is(acksB.length, ackB);
    };

    // no packets here
    await checkPending(0, 0, 0, 0);

    // ensure no problems running relayer with no packets
    await link.checkAndRelayPacketsAndAcks({});

    // send 3 from A -> B
    const amountsA = [1000, 2222, 3456];
    const txHeightsA = await transferTokens(
      nodeA,
      gaia.denomFee,
      nodeB,
      wasmd.prefix,
      channels.src,
      amountsA,
      5000, // never time out
    );
    // send 2 from B -> A
    const amountsB = [76543, 12345];
    const txHeightsB = await transferTokens(
      nodeB,
      wasmd.denomFee,
      nodeA,
      gaia.prefix,
      channels.dest,
      amountsB,
      5000, // never time out
    );
    await nodeA.waitOneBlock();

    // ensure these packets are present in query
    await checkPending(3, 2, 0, 0);

    // let's one on each side (should filter only the last == minHeight)
    const relayFrom: RelayedHeights = {
      packetHeightA: txHeightsA[2],
      packetHeightB: txHeightsB[1],
    };
    // check the result here and ensure it is after the latest height
    const nextRelay = await link.checkAndRelayPacketsAndAcks(relayFrom);

    // next acket is more recent than the transactions
    assert(nextRelay.packetHeightA);
    t.assert(nextRelay.packetHeightA > txHeightsA[2]);
    assert(nextRelay.packetHeightB);
    // since we don't wait a block after this transfer, it may be the same
    t.assert(nextRelay.packetHeightB >= txHeightsB[1]);
    // next ack queries is more recent than the packet queries
    assert(nextRelay.ackHeightA);
    t.assert(nextRelay.ackHeightA > nextRelay.packetHeightA);
    assert(nextRelay.ackHeightB);
    t.assert(nextRelay.ackHeightB > nextRelay.packetHeightB);

    // ensure those packets were sent, and their acks as well
    await checkPending(2, 1, 0, 0);

    // if we send again with the return of this last relay, we don't get anything new
    await link.checkAndRelayPacketsAndAcks(nextRelay);
    await checkPending(2, 1, 0, 0);

    // sent the remaining packets (no minimum)
    await link.checkAndRelayPacketsAndAcks({});

    // ensure those packets were sent, and their acks as well
    await checkPending(0, 0, 0, 0);
  },
);

test.serial("timeout expired packets", async (t) => {
  const logger = new TestLogger();
  const [nodeA, nodeB] = await setup(gaia, wasmd, logger);

  const link = await Link.createWithNewConnections(nodeA, nodeB, logger);
  const channels = await link.createChannel(
    "A",
    gaia.ics20Port,
    wasmd.ics20Port,
    ics20.ordering,
    ics20.version,
  );

  // no packets here
  const noPackets = await link.endA.querySentPackets();
  t.is(noPackets.length, 0);

  // some basic setup for the transfers
  const recipient = randomAddress(wasmd.prefix);
  const timeoutDestHeight = await nodeB.timeoutHeight(2);
  const submitDestHeight = await nodeB.timeoutHeight(500);
  const amounts = [1000, 2222, 3456];
  const timeoutHeights = [
    submitDestHeight,
    timeoutDestHeight,
    submitDestHeight,
    // we need the timeout height of the *receiving* chain
  ];
  const timedOut = secondsFromDateNanos(await nodeB.currentTime()) + 1;
  const plentyTime = timedOut + 3000;
  const timeoutTimes = [timedOut, plentyTime, plentyTime];
  // Note: 1st times out with time, 2nd with height, 3rd is valid

  // let's make 3 transfer tx at different heights
  const txHeights = [];
  for (let i = 0; i < amounts.length; ++i) {
    const token = { amount: amounts[i].toString(), denom: gaia.denomFee };
    const { height } = await nodeA.transferTokens(
      channels.src.portId,
      channels.src.channelId,
      token,
      recipient,
      timeoutHeights[i],
      timeoutTimes[i],
    );
    txHeights.push(height);
  }
  // ensure these are different
  t.assert(txHeights[1] > txHeights[0], txHeights.toString());
  t.assert(txHeights[2] > txHeights[1], txHeights.toString());
  // need to wait briefly for it to be indexed
  await nodeA.waitForIndexer();

  // now query for all packets
  const packets = await link.getPendingPackets("A");
  t.is(packets.length, 3);
  t.deepEqual(
    packets.map(({ height }) => height),
    txHeights,
  );

  // ensure no acks yet
  const preAcks = await link.getPendingAcks("B");
  t.is(preAcks.length, 0);

  // wait to trigger timeout
  await nodeA.waitOneBlock();
  await nodeA.waitOneBlock();
  await nodeA.waitOneBlock();
  // get the new state on dest (and give a little lee-way - 2 blocks / 1 second)
  const currentHeight = await link.endB.client.timeoutHeight(2);
  const currentTime =
    secondsFromDateNanos(await link.endB.client.currentTime()) + 1;

  const { toSubmit, toTimeout } = splitPendingPackets(
    currentHeight,
    currentTime,
    packets,
  );
  t.is(toSubmit.length, 1);
  t.is(toTimeout.length, 2);

  // submit the ones which didn't timeout
  const txAcks = await link.relayPackets("A", toSubmit);
  t.is(txAcks.length, 1);

  // one completed after relay
  const afterRelay = await link.getPendingPackets("A");
  t.is(afterRelay.length, 2);

  // try to submit the one which did timeout
  await t.throwsAsync(() => link.relayPackets("A", toTimeout));

  // timeout remaining packet
  await link.timeoutPackets("A", toTimeout);

  // nothing left after timeout
  const afterTimeout = await link.getPendingPackets("A");
  t.is(afterTimeout.length, 0);
});
