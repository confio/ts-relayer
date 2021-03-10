import path from 'path';

import { Logger } from 'winston';

import { registryFile } from '../../constants';
import { createLogger, Level } from '../../create-logger';
import { LoggerFlags } from '../../types';
import { loadAndValidateApp } from '../../utils/load-and-validate-app';
import { loadAndValidateRegistry } from '../../utils/load-and-validate-registry';
import { resolveOption } from '../../utils/options/resolve-option';
import { resolveRequiredOption } from '../../utils/options/resolve-required-option';
import { resolveHomeOption } from '../../utils/options/shared/resolve-home-option';
import { resolveKeyFileOption } from '../../utils/options/shared/resolve-key-file-option';
import { resolveMnemonicOption } from '../../utils/options/shared/resolve-mnemonic-option';

type Flags = {
  interactive: boolean;
  home?: string;
  src?: string;
  dest?: string;
  keyFile?: string;
  mnemonic?: string;
  srcConnection?: string;
  destConnection?: string;
} & LoggerFlags;

type Options = {
  home: string;
  src: string;
  dest: string;
  mnemonic: string;
  srcConnection: string;
  destConnection: string;
};

export async function start(flags: Flags) {
  const logLevel = resolveOption(
    flags.logLevel,
    process.env.RELAYER_LOG_LEVEL,
    'info'
  );

  const logger = createLogger(logLevel as Level);

  const home = resolveHomeOption({ homeFlag: flags.home });
  const app = loadAndValidateApp(home);
  const keyFile = resolveKeyFileOption({ keyFileFlag: flags.keyFile, app });
  const mnemonic = await resolveMnemonicOption({
    interactiveFlag: flags.interactive,
    keyFile,
    app,
  });

  const src = resolveRequiredOption('src')(
    flags.src,
    app?.src,
    process.env.RELAYER_SRC
  );
  const dest = resolveRequiredOption('dest')(
    flags.dest,
    app?.dest,
    process.env.RELAYER_DEST
  );

  const srcConnection = resolveRequiredOption('srcConnection')(
    flags.srcConnection,
    app?.srcConnection,
    process.env.RELAYER_SRC_CONNECTION
  );

  const destConnection = resolveRequiredOption('destConnection')(
    flags.destConnection,
    app?.destConnection,
    process.env.RELAYER_DEST_CONNECTION
  );

  const options: Options = {
    src,
    dest,
    home,
    mnemonic,
    srcConnection,
    destConnection,
  };

  run(options, logger);
}

function run(options: Options, logger: Logger) {
  const registryFilePath = path.join(options.home, registryFile);
  const { chains } = loadAndValidateRegistry(registryFilePath);
  const srcChain = chains[options.src];
  if (!srcChain) {
    throw new Error('src chain not found in registry');
  }
  const destChain = chains[options.dest];
  if (!destChain) {
    throw new Error('dest chain not found in registry');
  }

  console.log('ibc-relayer start with options:', options);
  logger.info('logger is available');
}
