import test from 'ava';

import { Order, State } from '../codec/ibc/core/channel/v1/channel';

import { Link } from './link';
import { setup } from './testutils.spec';

test.serial('establish new client-connection', async (t) => {
  const [src, dest] = await setup();

  const link = await Link.createConnection(src, dest);
  // ensure the data makes sense (TODO: more?)
  t.assert(link.endA.clientID.startsWith('07-tendermint-'), link.endA.clientID);
  t.assert(link.endB.clientID.startsWith('07-tendermint-'), link.endB.clientID);

  // try to update both clients, ensuring this connection is stable
  await link.updateClient('A');
  // TODO: ensure it is updated
  await link.updateClient('B');
  // TODO: ensure it is updated
});

// constants for this transport protocol
const ics20 = {
  // we set a new port in genesis for simapp
  srcPortId: 'custom',
  destPortId: 'transfer',
  version: 'ics20-1',
  ordering: Order.ORDER_UNORDERED,
};

test.serial('initialized connection and start channel handshake', async (t) => {
  const [src, dest] = await setup();
  const link = await Link.createConnection(src, dest);

  // reject channels with invalid ports
  t.throwsAsync(() =>
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
  t.throwsAsync(() =>
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
    const link = await Link.createConnection(nodeA, nodeB);

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
