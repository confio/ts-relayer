import test from 'ava';

import { Link } from './link';
import { ics20, randomAddress, setup, simapp, wasmd } from './testutils.spec';

test.serial.only('submit multiple tx, query all packets', async (t) => {
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
  const packets1 = await link.endA.querySentPackets();
  t.is(packets1.length, 0);

  // some basic setup for the transfers
  const recipient = randomAddress(wasmd.prefix);
  const destHeight = (await nodeB.latestHeader()).height + 500; // valid for 500 blocks
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
    txHeights
  );

  // // filter by minimum height
  // const packets3 = await link.endA.querySentPackets(txHeights[1]);
  // t.is(packets3.length, 2);
  // const packets4 = await link.endA.querySentPackets(txHeights[2] + 1);
  // t.is(packets4.length, 0);
});
