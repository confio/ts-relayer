import commander, { Option } from 'commander';

import { levels } from './create-logger';

export const homeOption = new Option(
  '--home <path>',
  'home option description (default: $HOME/.ibc-setup)'
);
export const keyFileOption = new Option('--key-file <path>');
export const mnemonicOption = new Option('--mnemonic <mnemonic>');
export const interactiveOption = new Option('-i, --interactive');
export const srcOption = new Option('--src <chain>');
export const destOption = new Option('--dest <chain>');

export const addLoggerOptionsTo = (command: commander.Command) => {
  return command
    .addOption(new Option('--log-level <level>').choices(Object.keys(levels)))
    .option('-v, --verbose')
    .option('-q, --quiet')
    .option('--log-file <path>');
};
