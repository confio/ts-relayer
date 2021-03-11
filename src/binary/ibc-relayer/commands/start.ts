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
import { resolveRequiredNumericOption } from '../../utils/options/resolve-required-numeric-option';
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
  poll?: number;
  maxAgeSrc?: number;
  maxAgeDest?: number;
} & LoggerFlags;

type LoopOptions = {
  // how many seconds we sleep between relaying batches
  poll: number;
  // number of seconds old the client on chain A can be
  maxAgeSrc: number;
  // number of seconds old the client on chain B can be
  maxAgeDest: number;
};

type Options = {
  home: string;
  src: string;
  dest: string;
  mnemonic: string;
  srcConnection: string;
  destConnection: string;
} & LoopOptions;

// some defaults for looping
const defaultOptions: LoopOptions = {
  // check once per minute
  poll: 60,
  // once per day: 86400s
  maxAgeSrc: 86400,
  maxAgeDest: 86400,
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

  // TODO: add this in app.yaml, process.env
  const poll = resolveRequiredNumericOption('poll')(
    flags.poll,
    defaultOptions.poll
  );
  const maxAgeSrc = resolveRequiredNumericOption('max-age-a')(
    flags.maxAgeSrc,
    defaultOptions.maxAgeSrc
  );
  const maxAgeDest = resolveRequiredNumericOption('max-age-b')(
    flags.maxAgeDest,
    defaultOptions.maxAgeDest
  );

  const options: Options = {
    src,
    dest,
    home,
    mnemonic,
    srcConnection,
    destConnection,
    // TODO: make configurable
    poll,
    // once per day: 86400s
    maxAgeSrc,
    maxAgeDest,
  };

  logger.verbose('Starting relayer with options', options);

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
    logger.info('Ensuring clients are not stale');
    await link.updateClientIfStale('A', options.maxAgeDest);
    await link.updateClientIfStale('B', options.maxAgeSrc);

    // sleep until the next step
    logger.info(`Sleeping ${options.poll} seconds...`);
    await sleep(options.poll * 1000);
  }
}
