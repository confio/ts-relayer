import { sleep } from '@cosmjs/utils';
import test from 'ava';

import { State } from '../codec/ibc/core/channel/v1/channel';

import { prepareChannelHandshake } from './ibcclient';
import { Link } from './link';
import {
  ics20,
  randomAddress,
  setup,
  simapp,
  TestLogger,
  wasmd,
} from './testutils.spec';

test.serial('establish new client-connection', async (t) => {
  const logger = new TestLogger();
  const [src, dest] = await setup();

  const link = await Link.createWithNewConnections(src, dest, logger);
  // ensure the data makes sense (TODO: more?)
  t.assert(link.endA.clientID.startsWith('07-tendermint-'), link.endA.clientID);
  t.assert(link.endB.clientID.startsWith('07-tendermint-'), link.endB.clientID);

  // try to update both clients, ensuring this connection is stable
  await link.updateClient('A');
  // TODO: ensure it is updated
  await link.updateClient('B');
  // TODO: ensure it is updated

  t.assert(logger.info.calledTwice, logger.info.callCount.toString());
});

test.serial('initialized connection and start channel handshake', async (t) => {
  const [src, dest] = await setup();
  const link = await Link.createWithNewConnections(src, dest);

  // reject channels with invalid ports
  await t.throwsAsync(() =>
    src.channelOpenInit(
      ics20.destPortId,
      ics20.destPortId,
      ics20.ordering,
      link.endA.connectionID,
      ics20.version
    )
  );
  // we need to wait a block for a new checkTx state, and proper sequences
  await src.waitOneBlock();

  // reject channels with invalid version
  await t.throwsAsync(() =>
    src.channelOpenInit(
      ics20.srcPortId,
      ics20.destPortId,
      ics20.ordering,
      link.endA.connectionID,
      'ics27'
    )
  );
  // we need to wait a block for a new checkTx state, and proper sequences
  await src.waitOneBlock();

  // this is valid and works
  const { channelId: channelIdSrc } = await src.channelOpenInit(
    ics20.srcPortId,
    ics20.destPortId,
    ics20.ordering,
    link.endA.connectionID,
    ics20.version
  );
  t.assert(channelIdSrc.startsWith('channel-'), channelIdSrc);
});

test.serial(
  'automated channel handshake on initialized connection',
  async (t) => {
    const [nodeA, nodeB] = await setup();
    const link = await Link.createWithNewConnections(nodeA, nodeB);

    // increment the channel sequence on src, to guarantee unique ids
    await nodeA.channelOpenInit(
      ics20.srcPortId,
      ics20.destPortId,
      ics20.ordering,
      link.endA.connectionID,
      ics20.version
    );

    // open a channel
    const channels = await link.createChannel(
      'A',
      ics20.srcPortId,
      ics20.destPortId,
      ics20.ordering,
      ics20.version
    );

    // ensure we bound expected ports
    t.is(channels.src.portId, ics20.srcPortId);
    t.is(channels.dest.portId, ics20.destPortId);
    // and have different channel ids (this depends on the increment above)
    t.not(channels.src.channelId, channels.dest.channelId);

    // query data
    const { channel } = await link.endB.client.query.ibc.channel.channel(
      ics20.destPortId,
      channels.dest.channelId
    );
    t.is(channel?.state, State.STATE_OPEN);
    t.is(channel?.ordering, ics20.ordering);
    t.is(channel?.counterparty?.channelId, channels.src.channelId);
  }
);

// createWithExistingConnections

test.serial('reuse existing connections', async (t) => {
  const [src, dest] = await setup();

  const oldLink = await Link.createWithNewConnections(src, dest);
  const connA = oldLink.endA.connectionID;
  const connB = oldLink.endB.connectionID;

  const oldChannels = await oldLink.createChannel(
    'A',
    ics20.srcPortId,
    ics20.destPortId,
    ics20.ordering,
    ics20.version
  );

  const newLink = await Link.createWithExistingConnections(
    src,
    dest,
    connA,
    connB
  );

  const channelSrc = await newLink.endA.client.query.ibc.channel.channel(
    ics20.srcPortId,
    oldChannels.src.channelId
  );
  t.is(channelSrc.channel?.state, State.STATE_OPEN);
  t.is(channelSrc.channel?.ordering, ics20.ordering);
  t.is(channelSrc.channel?.counterparty?.channelId, oldChannels.dest.channelId);
  const channelDest = await newLink.endB.client.query.ibc.channel.channel(
    ics20.destPortId,
    oldChannels.dest.channelId
  );
  t.is(channelDest.channel?.state, State.STATE_OPEN);
  t.is(channelDest.channel?.ordering, ics20.ordering);
  t.is(channelDest.channel?.counterparty?.channelId, oldChannels.src.channelId);

  // Check everything is fine by creating a new channel
  // switch src and dest just to test another path
  const newChannels = await newLink.createChannel(
    'B',
    ics20.destPortId,
    ics20.srcPortId,
    ics20.ordering,
    ics20.version
  );
  t.notDeepEqual(newChannels.dest, oldChannels.src);
});

test.serial(
  'reuse existing connections with partially open channel',
  async (t) => {
    const [src, dest] = await setup();

    const oldLink = await Link.createWithNewConnections(src, dest);
    const connA = oldLink.endA.connectionID;
    const connB = oldLink.endB.connectionID;

    const { channelId: srcChannelId } = await src.channelOpenInit(
      ics20.srcPortId,
      ics20.destPortId,
      ics20.ordering,
      connA,
      ics20.version
    );
    const proof = await prepareChannelHandshake(
      src,
      dest,
      oldLink.endB.clientID,
      ics20.srcPortId,
      srcChannelId
    );
    const { channelId: destChannelId } = await dest.channelOpenTry(
      ics20.destPortId,
      { portId: ics20.srcPortId, channelId: srcChannelId },
      ics20.ordering,
      connA,
      ics20.version,
      ics20.version,
      proof
    );

    const newLink = await Link.createWithExistingConnections(
      src,
      dest,
      connA,
      connB
    );
    const channelSrc = await newLink.endA.client.query.ibc.channel.channel(
      ics20.srcPortId,
      srcChannelId
    );
    t.is(channelSrc.channel?.state, State.STATE_INIT);
    t.is(channelSrc.channel?.ordering, ics20.ordering);
    // Counterparty channel ID not yet known
    t.is(channelSrc.channel?.counterparty?.channelId, '');
    const channelDest = await newLink.endB.client.query.ibc.channel.channel(
      ics20.destPortId,
      destChannelId
    );
    t.is(channelDest.channel?.state, State.STATE_TRYOPEN);
    t.is(channelDest.channel?.ordering, ics20.ordering);
    t.is(channelDest.channel?.counterparty?.channelId, srcChannelId);

    // Check everything is fine by creating a new channel
    // switch src and dest just to test another path
    const newChannels = await newLink.createChannel(
      'B',
      ics20.destPortId,
      ics20.srcPortId,
      ics20.ordering,
      ics20.version
    );
    t.notDeepEqual(newChannels.dest, {
      portId: ics20.srcPortId,
      channelId: srcChannelId,
    });
  }
);

test.serial('errors when reusing an invalid connection', async (t) => {
  const [src, dest] = await setup();

  // Make sure valid connections do exist
  await Link.createWithNewConnections(src, dest);

  const connA = 'whatever';
  const connB = 'unreal';
  await t.throwsAsync(() =>
    Link.createWithExistingConnections(src, dest, connA, connB)
  );
});

test.serial(`errors when reusing connections on the same node`, async (t) => {
  const [src, dest] = await setup();

  const oldLink = await Link.createWithNewConnections(src, dest);
  const connA = oldLink.endA.connectionID;

  await t.throwsAsync(() =>
    Link.createWithExistingConnections(src, src, connA, connA)
  );
});

test.serial(`errors when reusing connections which don’t match`, async (t) => {
  const [src, dest] = await setup();

  const oldLink1 = await Link.createWithNewConnections(src, dest);
  const connA = oldLink1.endA.connectionID;
  const oldLink2 = await Link.createWithNewConnections(src, dest);
  const connB = oldLink2.endB.connectionID;

  await t.throwsAsync(() =>
    Link.createWithExistingConnections(src, dest, connA, connB)
  );
});

test.serial('submit multiple tx, get unreceived packets', async (t) => {
  // setup a channel
  const [nodeA, nodeB] = await setup();
  const link = await Link.createWithNewConnections(nodeA, nodeB);
  const channels = await link.createChannel(
    'A',
    ics20.srcPortId,
    ics20.destPortId,
    ics20.ordering,
    ics20.version
  );

  // no packets here
  const noPackets = await link.endA.querySentPackets();
  t.is(noPackets.length, 0);

  // some basic setup for the transfers
  const recipient = randomAddress(wasmd.prefix);
  const destHeight = await nodeB.timeoutHeight(500); // valid for 500 blocks
  const amounts = [1000, 2222, 3456];
  // const totalSent = amounts.reduce((a, b) => a + b, 0);

  // let's make 3 transfer tx at different heights
  const txHeights = [];
  for (const amount of amounts) {
    const token = { amount: amount.toString(), denom: simapp.denomFee };
    const { height } = await nodeA.transferTokens(
      channels.src.portId,
      channels.src.channelId,
      token,
      recipient,
      destHeight
    );
    txHeights.push(height);
  }
  // ensure these are different
  t.assert(txHeights[1] > txHeights[0], txHeights.toString());
  t.assert(txHeights[2] > txHeights[1], txHeights.toString());
  // need to wait briefly for it to be indexed
  await sleep(100);

  // now query for all packets
  const packets = await link.getPendingPackets('A');
  t.is(packets.length, 3);
  t.deepEqual(
    packets.map(({ height }) => height),
    txHeights
  );
  // ensure the sender is set properly
  for (const packet of packets) {
    t.is(packet.sender, nodeA.senderAddress);
  }

  // ensure no acks yet
  const preAcks = await link.getPendingAcks('B');
  t.is(preAcks.length, 0);

  // let's pre-update to test conditional logic (no need to update below)
  await nodeA.waitOneBlock();
  await link.updateClient('A');

  // submit 2 of them (out of order)
  const submit = [packets[0], packets[2]];
  const txAcks = await link.relayPackets('A', submit);
  t.is(txAcks.length, 2);

  // ensure only one marked pending (for tx1)
  const postPackets = await link.getPendingPackets('A');
  t.is(postPackets.length, 1);
  t.is(postPackets[0].height, txHeights[1]);

  // ensure acks can be queried
  const acks = await link.getPendingAcks('B');
  t.is(acks.length, 2);

  // submit one of the acks, without waiting (it must update client)
  await link.relayAcks('B', acks.slice(0, 1));

  // ensure only one ack is still pending
  const postAcks = await link.getPendingAcks('B');
  t.is(postAcks.length, 1);
  // and it matches the one we did not send
  t.deepEqual(postAcks[0], acks[1]);
});

test.serial(
  'submit multiple tx on multiple channels, get unreceived packets',
  async (t) => {
    const logger = new TestLogger();
    // setup a channel
    const [nodeA, nodeB] = await setup(logger);
    const link = await Link.createWithNewConnections(nodeA, nodeB, logger);
    const channels1 = await link.createChannel(
      'A',
      ics20.srcPortId,
      ics20.destPortId,
      ics20.ordering,
      ics20.version
    );
    const channels2 = await link.createChannel(
      'A',
      ics20.srcPortId,
      ics20.destPortId,
      ics20.ordering,
      ics20.version
    );
    t.not(channels1.src.channelId, channels2.src.channelId);

    // no packets here
    const noPackets = await link.endA.querySentPackets();
    t.is(noPackets.length, 0);

    // some basic setup for the transfers
    const recipient = randomAddress(wasmd.prefix);
    const destHeight = await nodeB.timeoutHeight(500); // valid for 500 blocks
    const amounts = [1000, 2222, 3456];
    // const totalSent = amounts.reduce((a, b) => a + b, 0);

    // let's make 3 transfer tx at different heights on each channel pair
    interface Meta {
      height: number;
      channelId: string;
    }
    const txHeights = {
      channels1: [] as Meta[],
      channels2: [] as Meta[],
    };

    for (const amount of amounts) {
      const token = {
        amount: amount.toString(),
        denom: simapp.denomFee,
      };
      const { height } = await nodeA.transferTokens(
        channels1.src.portId,
        channels1.src.channelId,
        token,
        recipient,
        destHeight
      );
      txHeights.channels1.push({ height, channelId: channels1.src.channelId });
    }
    for (const amount of amounts) {
      const token = {
        amount: amount.toString(),
        denom: simapp.denomFee,
      };
      const { height } = await nodeA.transferTokens(
        channels2.src.portId,
        channels2.src.channelId,
        token,
        recipient,
        destHeight
      );
      txHeights.channels2.push({ height, channelId: channels2.src.channelId });
    }

    // need to wait briefly for it to be indexed
    await sleep(100);

    // now query for all packets, ensuring we mapped the channels properly
    const packets = await link.getPendingPackets('A');
    t.is(packets.length, 6);
    t.deepEqual(
      packets.map(({ height, packet }) => ({
        height,
        channelId: packet.sourceChannel,
      })),
      [...txHeights.channels1, ...txHeights.channels2]
    );

    // ensure the sender is set properly
    for (const packet of packets) {
      t.is(packet.sender, nodeA.senderAddress);
    }

    // ensure no acks yet
    const preAcks = await link.getPendingAcks('B');
    t.is(preAcks.length, 0);

    // submit 4 of them (out of order) - make sure not to use same sequences on both sides
    const packetsToSubmit = [packets[0], packets[1], packets[4], packets[5]];
    const txAcks = await link.relayPackets('A', packetsToSubmit);
    t.is(txAcks.length, 4);

    // ensure only two marked pending (for tx1)
    const postPackets = await link.getPendingPackets('A');
    t.is(postPackets.length, 2);
    t.is(postPackets[0].height, txHeights.channels1[2].height);
    t.is(postPackets[1].height, txHeights.channels2[0].height);

    // ensure acks can be queried
    const acks = await link.getPendingAcks('B');
    t.is(acks.length, 4);

    // make sure we ack on different channels (and different sequences)
    t.not(
      acks[0].originalPacket.sourceChannel,
      acks[3].originalPacket.sourceChannel
    );
    t.not(acks[0].originalPacket.sequence, acks[3].originalPacket.sequence);
    await link.relayAcks('B', [acks[0], acks[3]]);

    // ensure only two acks are still pending
    const postAcks = await link.getPendingAcks('B');
    t.is(postAcks.length, 2);
    // and it matches the ones we did not send
    t.deepEqual(postAcks[0], acks[1]);
    t.deepEqual(postAcks[1], acks[2]);
  }
);
