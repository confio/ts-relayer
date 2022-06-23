import { ChannelPair } from '../link';
import { ics20 } from '../testutils';

// TODO: use env vars
// copy these values from `ibc-setup keys list`
export const gaiaAddress = 'cosmos1th0wrczcl2zatnku20zdmmctmdrwh22t89r4s0';
export const wasmdAddress = 'wasm1x8ztrc7zqj2t5jvtyr6ncv7fwp62z2y22alpwu';

// TODO: use env vars
// we assume src is simapp for all these tests
export const channels: ChannelPair = {
  src: {
    channelId: 'channel-17',
    portId: ics20.srcPortId, // custom
  },
  dest: {
    channelId: 'channel-15',
    portId: ics20.destPortId, // transfer
  },
};
