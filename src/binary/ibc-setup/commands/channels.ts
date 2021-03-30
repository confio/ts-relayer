import path from 'path';

import { State as ChannelState } from '../../../codec/ibc/core/channel/v1/channel';
import { Logger } from '../../create-logger';
import { registryFile } from '../../constants';
import { borderLessTable } from '../../utils/border-less-table';
import { generateMnemonic } from '../../utils/generate-mnemonic';
import { loadAndValidateApp } from '../../utils/load-and-validate-app';
import { loadAndValidateRegistry } from '../../utils/load-and-validate-registry';
import { resolveOption } from '../../utils/options/resolve-option';
import { resolveHomeOption } from '../../utils/options/shared/resolve-home-option';
import { resolveKeyFileOption } from '../../utils/options/shared/resolve-key-file-option';
import { resolveMnemonicOption } from '../../utils/options/shared/resolve-mnemonic-option';
import { signingClient } from '../../utils/signing-client';

export type Flags = {
  readonly home?: string;
  readonly port?: string;
  readonly chain?: string;
  readonly mnemonic?: string;
  readonly keyFile?: string;
  readonly interactive: boolean;
};

export type Options = {
  readonly home: string;
  readonly chain: string;
  readonly mnemonic: string | null;
  readonly port: string | null;
};

export async function channels(flags: Flags, logger: Logger) {
  const home = resolveHomeOption({ homeFlag: flags.home });
  const app = loadAndValidateApp(home);
  const keyFile = resolveKeyFileOption({ keyFileFlag: flags.keyFile, app });
  const chain = resolveOption('chain', { required: true })(
    flags.chain,
    process.env.RELAYER_CHAIN
  );
  const port = resolveOption('port')(flags.port, process.env.RELAYER_PORT);

  const mnemonic = await resolveMnemonicOption(
    {
      interactiveFlag: flags.interactive,
      mnemonicFlag: flags.mnemonic,
      keyFile,
      app,
    },
    true // mnemonic is optional
  );

  const options: Options = {
    home,
    chain,
    mnemonic,
    port,
  };

  await run(options, logger);
}

function channelStateAsText(state: ChannelState) {
  switch (state) {
    case ChannelState.STATE_CLOSED:
      return 'Closed';

    case ChannelState.STATE_INIT:
      return 'Init';

    case ChannelState.STATE_OPEN:
      return 'Open';

    case ChannelState.STATE_TRYOPEN:
      return 'Tryopen';

    case ChannelState.STATE_UNINITIALIZED_UNSPECIFIED:
      return 'UninitializedUnspecified';

    case ChannelState.UNRECOGNIZED:
    default:
      return 'Unrecognized';
  }
}

export async function run(options: Options, logger: Logger) {
  const registryFilePath = path.join(options.home, registryFile);
  const registry = loadAndValidateRegistry(registryFilePath);

  const chain = registry.chains[options.chain];
  if (!chain) {
    throw new Error(`Chain ${options.chain} not found in ${registryFilePath}.`);
  }

  const mnemonic = options.mnemonic ?? generateMnemonic();

  const client = await signingClient(chain, mnemonic, logger);

  const {
    channels: allChannels,
  } = await client.query.ibc.channel.allChannels();

  const channels = allChannels
    .filter(
      (channel) => (options.port ? channel.portId === options.port : true) // don't filter if port is not specified
    )
    .map((channel) => [
      channel.channelId,
      channel.portId,
      channelStateAsText(channel.state),
    ]);

  if (!channels.length) {
    const conditionalPortInfo = options.port
      ? ` on port "${options.port}".`
      : '.';
    logger.info(
      `No channels found for chain "${options.chain}"${conditionalPortInfo}`
    );

    return;
  }

  const output = borderLessTable([
    ['CHANNEL_ID', 'PORT', 'STATE'],
    ...channels,
  ]);

  console.log(output);
}
