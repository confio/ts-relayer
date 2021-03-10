import path from 'path';

import { sleep } from '@cosmjs/utils';
import { Logger } from 'winston';

import { Link } from '../../../lib/link';
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
import { signingClient } from '../../utils/signing-client';

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

// TODO: do we want to make this a flag?
type LoopOptions = {
  // how many seconds we sleep between relaying batches
  pollingFrequency: number;
  // number of seconds old the client on chain A can be
  maxAgeA: number;
  // number of seconds old the client on chain B can be
  maxAgeB: number;
};

type Options = {
  home: string;
  src: string;
  dest: string;
  mnemonic: string;
  srcConnection: string;
  destConnection: string;
} & LoopOptions;

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
    // TODO: make configurable
    pollingFrequency: 60,
    // once per day: 86400s
    maxAgeA: 86400,
    maxAgeB: 86400,
  };

  await run(options, logger);
}

async function run(options: Options, logger: Logger) {
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

  const nodeA = await signingClient(srcChain, options.mnemonic, logger);
  const nodeB = await signingClient(destChain, options.mnemonic, logger);
  const link = await Link.createWithExistingConnections(
    nodeA,
    nodeB,
    options.srcConnection,
    options.destConnection,
    logger
  );

  await relayerLoop(link, options, logger);
}

async function relayerLoop(link: Link, options: LoopOptions, logger: Logger) {
  // TODO: fill this in with real data on init
  // (how far back do we start querying... where do we store state?)
  let nextRelay = {};

  const done = false;
  while (!done) {
    logger.info('... waking up and checking for packets!');
    nextRelay = await link.checkAndRelayPacketsAndAcks(nextRelay);

    // ensure the headers are up to date (only submits if old and we didn't just update them above)
    await link.updateClientIfStale('A', options.maxAgeB);
    await link.updateClientIfStale('B', options.maxAgeA);

    // sleep until the next step
    logger.info(`Sleeping ${options.pollingFrequency} seconds...`);
    await sleep(options.pollingFrequency * 1000);
  }
}
