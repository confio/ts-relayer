#!/usr/bin/env node

import { Command, Option } from 'commander';

import {
  destOption,
  homeOption,
  interactiveOption,
  keyFileOption,
  mnemonicOption,
  srcOption,
} from '../commander-options';

import { start } from './commands/start';

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

  .action(start);

program.parse(process.argv);
