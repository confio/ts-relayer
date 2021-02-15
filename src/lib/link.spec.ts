import test from 'ava';

import { Order } from '../codec/ibc/core/channel/v1/channel';

import { prepareChannelHandshake } from './ibcclient';
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
  portId: 'transfer',
  version: 'ics20-1',
  ordering: Order.ORDER_UNORDERED,
};

test.serial('initialized connection and start channel handshake', async (t) => {
  const [src, dest] = await setup();
  const link = await Link.createConnection(src, dest);

  // reject channels with invalid ports
  t.throwsAsync(() =>
    src.channelOpenInit(
      'bad-port',
      ics20.portId,
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
      ics20.portId,
      ics20.portId,
      ics20.ordering,
      link.endA.connectionID,
      'ics27'
    )
  );
  // we need to wait a block for a new checkTx state, and proper sequences
  await src.waitOneBlock();

  // this is valid and works
  const { channelId: channelIdSrc } = await src.channelOpenInit(
    ics20.portId,
    ics20.portId,
    ics20.ordering,
    link.endA.connectionID,
    ics20.version
  );
  t.assert(channelIdSrc.startsWith('channel-'), channelIdSrc);
});

test.only('manual channel handshake on initialized connection', async (t) => {
  const [src, dest] = await setup();
  const link = await Link.createConnection(src, dest);

  // init on src/A
  const { channelId: channelIdSrc } = await src.channelOpenInit(
    ics20.portId,
    ics20.portId,
    ics20.ordering,
    link.endA.connectionID,
    ics20.version
  );
  t.assert(channelIdSrc.startsWith('channel-'), channelIdSrc);

  // try on dest/B
  const proof = await prepareChannelHandshake(
    src,
    dest,
    link.endB.clientID,
    ics20.portId,
    channelIdSrc
  );
  const { channelId: channelIdDest } = await dest.channelOpenTry(
    ics20.portId,
    { portId: ics20.portId, channelId: channelIdSrc },
    ics20.ordering,
    link.endA.connectionID,
    ics20.version,
    ics20.version,
    proof
  );
  t.assert(channelIdDest.startsWith('channel-'), channelIdDest);

  // ack on src/A
  const proofAck = await prepareChannelHandshake(
    dest,
    src,
    link.endA.clientID,
    ics20.portId,
    channelIdDest
  );
  await src.channelOpenAck(
    ics20.portId,
    channelIdSrc,
    channelIdDest,
    ics20.version,
    proofAck
  );

  // confirm on dest/B
  const proofConfirm = await prepareChannelHandshake(
    src,
    dest,
    link.endB.clientID,
    ics20.portId,
    channelIdSrc
  );
  await dest.channelOpenConfirm(ics20.portId, channelIdDest, proofConfirm);
});
