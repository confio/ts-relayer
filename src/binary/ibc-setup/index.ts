#!/usr/bin/env node

import { Command } from 'commander';

import {
  addLoggerOptionsTo,
  chainOption,
  destConnection,
  destOption,
  destPort,
  destTrust,
  homeOption,
  interactiveOption,
  keyFileOption,
  mnemonicOption,
  srcConnection,
  srcOption,
  srcPort,
  srcTrust,
} from '../commander-options';
import { loggerWithErrorBoundary } from '../utils/logger-with-error-boundary';

import { balances } from './commands/balances';
import { channel } from './commands/channel';
import { channels } from './commands/channels';
import { connect } from './commands/connect';
import { connections } from './commands/connections';
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
  .action(loggerWithErrorBoundary(init));
addLoggerOptionsTo(initCommand);

const ics20Command = program
  .command('ics20')
  .description('ics20 command description')
  .addOption(srcOption)
  .addOption(destOption)
  .addOption(srcTrust)
  .addOption(destTrust)
  .addOption(mnemonicOption)
  .addOption(srcPort)
  .addOption(destPort)
  .action(loggerWithErrorBoundary(ics20));
addLoggerOptionsTo(ics20Command);

const keys = program.command('keys');

const keysGenerateCommand = keys
  .command('generate')
  .description('keys generate command description')
  .addOption(keyFileOption)
  .action(loggerWithErrorBoundary(keysGenerate));
addLoggerOptionsTo(keysGenerateCommand);

const keysListCommand = keys
  .command('list')
  .description('keys list command description')
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(keyFileOption)
  .addOption(interactiveOption)
  .action(loggerWithErrorBoundary(keysList));
addLoggerOptionsTo(keysListCommand);

const balancesCommand = program
  .command('balances')
  .description('balances command description')
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(keyFileOption)
  .addOption(interactiveOption)
  .action(loggerWithErrorBoundary(balances));
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
  .addOption(srcTrust)
  .addOption(destTrust)
  .action(loggerWithErrorBoundary(connect));
addLoggerOptionsTo(connectCommand);

const channelsCommand = program
  .command('channels')
  .description('channels command description')
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(interactiveOption)
  .addOption(chainOption)
  .option('--port <port>')
  .action(loggerWithErrorBoundary(channels));
addLoggerOptionsTo(channelsCommand);

const channelCommand = program
  .command('channel')
  .description('channel command description')
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(interactiveOption)
  .addOption(keyFileOption)
  .addOption(srcOption)
  .addOption(destOption)
  .addOption(srcConnection)
  .addOption(destConnection)
  .addOption(srcPort)
  .addOption(destPort)
  .option('--ordered')
  .option('--version <version>')
  .action(loggerWithErrorBoundary(channel));
addLoggerOptionsTo(channelCommand);

const connectionsCommand = program
  .command('connections')
  .description('connections command description')
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(interactiveOption)
  .addOption(chainOption)
  .action(loggerWithErrorBoundary(connections));
addLoggerOptionsTo(connectionsCommand);

program.parse(process.argv);
