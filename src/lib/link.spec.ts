import test from 'ava';

import { Order, State } from '../codec/ibc/core/channel/v1/channel';

import { Link } from './link';
import { setup } from './testutils.spec';

// constants for this transport protocol
const ics20 = {
  // we set a new port in genesis for simapp
  srcPortId: 'custom',
  destPortId: 'transfer',
  version: 'ics20-1',
  ordering: Order.ORDER_UNORDERED,
};

// createWithNewConnections

test.serial('establish new client-connection', async (t) => {
  const [src, dest] = await setup();

  const link = await Link.createWithNewConnections(src, dest);
  // ensure the data makes sense (TODO: more?)
  t.assert(link.endA.clientID.startsWith('07-tendermint-'), link.endA.clientID);
  t.assert(link.endB.clientID.startsWith('07-tendermint-'), link.endB.clientID);

  // try to update both clients, ensuring this connection is stable
  await link.updateClient('A');
  // TODO: ensure it is updated
  await link.updateClient('B');
  // TODO: ensure it is updated
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
  // TODO: Why does this fail with this error?
  // failed to execute message; message index: 0: channel handshake open try failed: failed channel state verification for client (07-tendermint-42): client state height < proof height ({0 17506} < {0 17512}): invalid height
  // await newLink.createChannel(
  //   'A',
  //   ics20.srcPortId,
  //   ics20.destPortId,
  //   ics20.ordering,
  //   ics20.version
  // );
});

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
