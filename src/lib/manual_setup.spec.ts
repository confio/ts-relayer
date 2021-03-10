/*
This file is designed to be run to fund accounts and send packets when manually
testing ibc-setup and ibc-relayer on localhost.

Please configure the global variables to match the accounts displayed by
`ibc-setup keys list` before running, and use `.only` or `.skip` to control
which tests are run.

Execute via:

yarn build && yarn test:unit ./src/lib/manual_setup.spec.ts
*/

import test from 'ava';

import { ChannelPair } from './link';
import {
  fundAccount,
  ics20,
  setup,
  simapp,
  TestLogger,
  transferTokens,
  wasmd,
} from './testutils';

// copy these values from `ibc-setup keys list`
const simappAddress = 'cosmos1t4p6yt2r9rcwfesj0feyu9x3ywhlvyww0azh0a';
const wasmdAddress = 'wasm1090w503askudf40zzkkaj45dax98mdjym7p32e';

// we assume src is simapp for all these tests
const channels: ChannelPair = {
  src: {
    channelId: 'channel-1',
    portId: ics20.srcPortId,
  },
  dest: {
    channelId: 'channel-1',
    portId: ics20.destPortId,
  },
};

test.serial('fund relayer', async (t) => {
  await fundAccount(simapp, simappAddress, '50000000');
  await fundAccount(wasmd, wasmdAddress, '50000000');

  // to make ava happy
  t.is(1, 1);
});

test.serial('send valid packets on existing channel', async (t) => {
  // create the basic clients
  const logger = new TestLogger();
  const [src, dest] = await setup(logger);

  // send some from src to dest
  const srcAmounts = [1200, 32222, 3456];
  const srcPackets = await transferTokens(
    src,
    simapp.denomFee,
    dest,
    wasmd.prefix,
    channels.src,
    srcAmounts
  );
  t.is(srcAmounts.length, srcPackets.length);

  // send some from dest to src
  const destAmounts = [426238, 321989];
  const destPackets = await transferTokens(
    dest,
    wasmd.denomFee,
    src,
    simapp.prefix,
    channels.dest,
    destAmounts
  );
  t.is(destAmounts.length, destPackets.length);
});
