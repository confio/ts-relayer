#!/usr/bin/env node

import { Command, Option } from 'commander';

import { balances } from './commands/balances';
import { connect } from './commands/connect';
import { ics20 } from './commands/ics20';
import { init } from './commands/init';
import { keysGenerate } from './commands/keys-generate';
import { keysList } from './commands/keys-list';

export const program = new Command();

// TODO: fill options and commands descriptions
program.description('ibc-setup program description');

const homeOption = new Option(
  '--home <path>',
  'home option description (default: $HOME/.ibc-setup)'
);
const keyFileOption = new Option('--key-file <path>');
const mnemonicOption = new Option('--mnemonic <mnemonic>');
const interactiveOption = new Option('-i, --interactive');
const srcOption = new Option('--src <chain>');
const destOption = new Option('--dest <chain>');

program
  .command('init')
  .description('init command description')
  .addOption(homeOption)
  .addOption(srcOption)
  .addOption(destOption)
  .action(init);

program
  .command('ics20')
  .description('ics20 command description')
  .addOption(srcOption)
  .addOption(destOption)
  .addOption(mnemonicOption)
  .option('--src-port <port>')
  .option('--dest-port <port>')
  .action(ics20);

const keys = program.command('keys');

keys
  .command('generate')
  .description('keys generate command description')
  .addOption(keyFileOption)
  .action(keysGenerate);

keys
  .command('list')
  .description('keys list command description')
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(keyFileOption)
  .addOption(interactiveOption)
  .action(keysList);

program
  .command('balances')
  .description('balances command description')
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(keyFileOption)
  .addOption(interactiveOption)
  .action(balances);

program
  .command('connect')
  .description('connect command description')
  .addOption(srcOption)
  .addOption(destOption)
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(keyFileOption)
  .addOption(interactiveOption)
  .action(connect);

program.parse(process.argv);
