#!/usr/bin/env node

import { Command } from 'commander';

import { init } from './commands/init';
import { keysGenerate } from './commands/keys-generate';
import { keysList } from './commands/keys-list';

export const program = new Command();

// TODO: fill options and commands descriptions
program
  .description('ibc-setup program description')
  .option(
    '--home <path>',
    'home option description (default: $HOME/.ibc-setup)'
  );

program
  .command('init')
  .description('init command description')
  .option('--src <chain>')
  .option('--dest <chain>')
  .action(init);

const keys = program.command('keys');

keys
  .command('generate')
  .description('keys generate command description')
  .option('--key-file <path>')
  .action(keysGenerate);

keys
  .command('list')
  .description('keys list command description')
  .option('--mnemonic <mnemonic>')
  .option('--key-file <path>')
  .option('-i, --interactive')
  .action(keysList);

program.parse(process.argv);
