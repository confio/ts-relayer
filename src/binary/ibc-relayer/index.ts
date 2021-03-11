#!/usr/bin/env node

import { Command, InvalidOptionArgumentError, Option } from 'commander';

import {
  destOption,
  homeOption,
  interactiveOption,
  keyFileOption,
  mnemonicOption,
  srcOption,
} from '../commander-options';
import { rootBoundary } from '../utils/error-boundary';

import { start } from './commands/start';

function parseNumber(value: string) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new InvalidOptionArgumentError('Not a number.');
  }
  return parsed;
}

const program = new Command();

program.description('ibc-relayer program description');

program
  .command('start')
  .description('start command description')
  .addOption(homeOption)
  .addOption(srcOption)
  .addOption(destOption)
  .addOption(interactiveOption)
  .addOption(keyFileOption)
  .addOption(mnemonicOption)
  .option('--src-connection <connection>')
  .option('--dest-connection <connection>')
  .option(
    '--poll <frequency>',
    'how many second we sleep between checking for packets',
    parseNumber
  )
  .option(
    '--max-age-src <seconds>',
    'how old can the client on src chain be, before we update it',
    parseNumber
  )
  .option(
    '--max-age-dest <seconds>',
    'how old can the client on dest chain be, before we update it',
    parseNumber
  )
  .addOption(
    new Option('--log-level <level>').choices([
      'debug',
      'verbose',
      'info',
      'warn',
      'error',
    ])
  )
  .option('-v, --verbose')
  .option('-q, --quiet')
  .action(rootBoundary(start));

program.parse(process.argv);
