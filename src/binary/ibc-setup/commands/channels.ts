import os from 'os';
import path from 'path';

import { State } from '../../../codec/ibc/core/channel/v1/channel';
import { registryFile } from '../../constants';
import { generateMnemonic } from '../../utils/generate-mnemonic';
import { loadAndValidateApp } from '../../utils/load-and-validate-app';
import { loadAndValidateRegistry } from '../../utils/load-and-validate-registry';
import { resolveOption } from '../../utils/options/resolve-option';
import { resolveRequiredOption } from '../../utils/options/resolve-required-option';
import { resolveHomeOption } from '../../utils/options/shared/resolve-home-option';
import { resolveKeyFileOption } from '../../utils/options/shared/resolve-key-file-option';
import { resolveMnemonicOption } from '../../utils/options/shared/resolve-mnemonic-option';

import { createClient } from './ics20';

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

export async function channels(flags: Flags) {
  const home = resolveHomeOption({ homeFlag: flags.home });
  const app = loadAndValidateApp(home);
  const keyFile = resolveKeyFileOption({ keyFileFlag: flags.keyFile, app });
  const chain = resolveRequiredOption('chain')(
    flags.chain,
    process.env.RELAYER_CHAIN
  );
  const port = resolveOption(flags.port, process.env.RELAYER_PORT);

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

  await run(options);
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

export async function run(options: Options) {
  const registryFilePath = path.join(options.home, registryFile);
  const registry = loadAndValidateRegistry(registryFilePath);

  const chain = registry.chains[options.chain];
  if (!chain) {
    throw new Error(`Chain ${options.chain} not found in ${registryFilePath}.`);
  }

  const mnemonic = assureMnemonic(options.mnemonic);

  const client = await createClient(mnemonic, {
    prefix: chain.prefix,
    rpc: chain.rpc,
    hd_path: chain.hd_path,
  });

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
    console.log(
      `Found no channels for chain "${options.chain}"${conditionalPortInfo}`
    );

    return;
  }

  const output = [
    ['CHANNEL_ID', 'PORT', 'STATE'].map(appendSpaces).join(''),
    ...channels,
  ].join(os.EOL);

  console.log(output);
}
