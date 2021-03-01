#!/usr/bin/env node

import { Command } from 'commander';

import { init } from './commands/init';
import { keysGenerate } from './commands/keys-generate';

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

program.parse(process.argv);
