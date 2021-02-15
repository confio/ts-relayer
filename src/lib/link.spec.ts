import test from 'ava';

import { Order } from '../codec/ibc/core/channel/v1/channel';

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

test.only('perform manual channel handshake on initialized channel', async (t) => {
  const [src, dest] = await setup();
  const link = await Link.createConnection(src, dest);

  // start channel handshake
  const { channelId: channelIdSrc } = await src.channelOpenInit(
    'transfer',
    'transfer',
    Order.ORDER_UNORDERED,
    link.endA.connectionID,
    'ics20-1'
  );
  // first channel on this connections
  t.is(channelIdSrc, 'channel-1');
});
