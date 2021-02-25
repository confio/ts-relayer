#!/usr/bin/env node

import { Command } from 'commander';

import { init } from './commands/init';

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

program.parse(process.argv);
