/*
This file is designed to be run to fund accounts and send packets when manually
testing ibc-setup and ibc-relayer on localhost.

Please configure the global variables to match the accounts displayed by
`ibc-setup keys list` before running.

Execute via:

yarn build && yarn test:unit ./src/lib/manual/create-packets.spec.ts
*/

import test from "ava";

import { gaia, setup, TestLogger, transferTokens, wasmd } from "../helpers";

import { channels } from "./consts";

test.serial.skip("send valid packets on existing channel", async (t) => {
  // create the basic clients
  const logger = new TestLogger();
  const [src, dest] = await setup(gaia, wasmd, logger);

  // send some from src to dest
  const srcAmounts = [1200, 32222, 3456];
  const srcPackets = await transferTokens(
    src,
    gaia.denomFee,
    dest,
    wasmd.prefix,
    channels.src,
    srcAmounts,
  );
  t.is(srcAmounts.length, srcPackets.length);

  // send some from dest to src
  const destAmounts = [426238, 321989];
  const destPackets = await transferTokens(
    dest,
    wasmd.denomFee,
    src,
    gaia.prefix,
    channels.dest,
    destAmounts,
  );
  t.is(destAmounts.length, destPackets.length);
});
