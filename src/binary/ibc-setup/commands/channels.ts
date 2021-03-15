import os from 'os';
import path from 'path';

import { Logger } from 'winston';

import { State } from '../../../codec/ibc/core/channel/v1/channel';
import { registryFile } from '../../constants';
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

function assureMnemonic(mnemonic: string | null) {
  if (!mnemonic) {
    return generateMnemonic();
  }

  return mnemonic;
}

function stateAsText(state: State) {
  switch (state) {
    case State.STATE_CLOSED:
      return 'Closed';

    case State.STATE_INIT:
      return 'Init';

    case State.STATE_OPEN:
      return 'Open';

    case State.STATE_TRYOPEN:
      return 'Tryopen';

    case State.STATE_UNINITIALIZED_UNSPECIFIED:
      return 'UninitializedUnspecified';

    case State.UNRECOGNIZED:
    default:
      return 'Unrecognized';
  }
}

function appendSpaces(value: string) {
  const spaces = new Array(24 - value.length).fill(' ').join('');
  return `${value}${spaces}`;
}

export async function run(options: Options, logger: Logger) {
  const registryFilePath = path.join(options.home, registryFile);
  const registry = loadAndValidateRegistry(registryFilePath);

  const chain = registry.chains[options.chain];
  if (!chain) {
    throw new Error(`Chain ${options.chain} not found in ${registryFilePath}.`);
  }

  const mnemonic = assureMnemonic(options.mnemonic);

  const client = await signingClient(chain, mnemonic, logger);

  const {
    channels: allChannels,
  } = await client.query.ibc.channel.allChannels();

  const channels = allChannels
    .filter(
      (channel) => (options.port ? channel.portId === options.port : true) // don't filter if port is not specified
    )
    .map((channel) =>
      [channel.channelId, channel.portId, stateAsText(channel.state)]
        .map(appendSpaces)
        .join('')
    );

  if (!channels.length) {
    const conditionalPortInfo = options.port
      ? ` on port "${options.port}".`
      : '.';
    logger.info(
      `Found no channels for chain "${options.chain}"${conditionalPortInfo}`
    );

    return;
  }

  const output = [
    ['CHANNEL_ID', 'PORT', 'STATE'].map(appendSpaces).join(''),
    ...channels,
  ].join(os.EOL);

  logger.info(output);
}
