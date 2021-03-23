#!/usr/bin/env node

import { Command } from 'commander';

import {
  addLoggerOptionsTo,
  destConnection,
  destOption,
  homeOption,
  interactiveOption,
  keyFileOption,
  mnemonicOption,
  srcConnection,
  srcOption,
} from '../commander-options';
import { loggerWithErrorBoundary } from '../utils/logger-with-error-boundary';

import { start } from './commands/start';

const program = new Command();

program.description('ibc-relayer program description');

const startCommand = program
  .command('start')
  .description('start command description')
  .addOption(homeOption)
  .addOption(srcOption)
  .addOption(destOption)
  .addOption(interactiveOption)
  .addOption(keyFileOption)
  .addOption(mnemonicOption)
  .addOption(srcConnection)
  .addOption(destConnection)
  .option(
    '--poll <frequency>',
    'how many second we sleep between checking for packets'
  )
  .option(
    '--max-age-src <seconds>',
    'how old can the client on src chain be, before we update it'
  )
  .option(
    '--max-age-dest <seconds>',
    'how old can the client on dest chain be, before we update it'
  )
  .option('--scan-from-src <height>')
  .option('--scan-from-dest <height>')
  // note: once is designed for debugging and unit tests
  .option('--once', 'just relay pending packets and quit, no polling')
  .action(loggerWithErrorBoundary(start));

addLoggerOptionsTo(startCommand);

program.parse(process.argv);
