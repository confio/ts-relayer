#!/usr/bin/env node

import { Command, Option } from 'commander';

import { balances } from './commands/balances';
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

program
  .command('init')
  .description('init command description')
  .addOption(homeOption)
  .option('--src <chain>')
  .option('--dest <chain>')
  .action(init);

program.command('ics20').description('ics20 command description').action(ics20);

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

program.parse(process.argv);
