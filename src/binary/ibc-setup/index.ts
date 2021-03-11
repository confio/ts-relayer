#!/usr/bin/env node

import { Command } from 'commander';

import {
  addLoggerOptionsTo,
  destOption,
  homeOption,
  interactiveOption,
  keyFileOption,
  mnemonicOption,
  srcOption,
} from '../commander-options';

import { balances } from './commands/balances';
import { channels } from './commands/channels';
import { connect } from './commands/connect';
import { ics20 } from './commands/ics20';
import { init } from './commands/init';
import { keysGenerate } from './commands/keys-generate';
import { keysList } from './commands/keys-list';

export const program = new Command();

// TODO: fill options and commands descriptions
program.description('ibc-setup program description');

const initCommand = program
  .command('init')
  .description('init command description')
  .addOption(homeOption)
  .addOption(srcOption)
  .addOption(destOption)
  .action(init);
addLoggerOptionsTo(initCommand);

const ics20Command = program
  .command('ics20')
  .description('ics20 command description')
  .addOption(srcOption)
  .addOption(destOption)
  .addOption(mnemonicOption)
  .option('--src-port <port>')
  .option('--dest-port <port>')
  .action(ics20);
addLoggerOptionsTo(ics20Command);

const keys = program.command('keys');

const keysGenerateCommand = keys
  .command('generate')
  .description('keys generate command description')
  .addOption(keyFileOption)
  .action(keysGenerate);
addLoggerOptionsTo(keysGenerateCommand);

const keysListCommand = keys
  .command('list')
  .description('keys list command description')
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(keyFileOption)
  .addOption(interactiveOption)
  .action(keysList);
addLoggerOptionsTo(keysListCommand);

const balancesCommand = program
  .command('balances')
  .description('balances command description')
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(keyFileOption)
  .addOption(interactiveOption)
  .action(balances);
addLoggerOptionsTo(balancesCommand);

const connectCommand = program
  .command('connect')
  .description('connect command description')
  .addOption(srcOption)
  .addOption(destOption)
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(keyFileOption)
  .addOption(interactiveOption)
  .action(connect);
addLoggerOptionsTo(connectCommand);

const channelsCommand = program
  .command('channels')
  .description('channels command description')
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(interactiveOption)
  .option('--chain <chain>')
  .option('--port <port>')
  .action(channels);
addLoggerOptionsTo(channelsCommand);

program.parse(process.argv);
