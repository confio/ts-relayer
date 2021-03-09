#!/usr/bin/env node

import { Command } from 'commander';

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
  .action(start);

program.parse(process.argv);
