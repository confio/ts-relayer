import { Option } from 'commander';

export const homeOption = new Option(
  '--home <path>',
  'home option description (default: $HOME/.ibc-setup)'
);
export const keyFileOption = new Option('--key-file <path>');
export const mnemonicOption = new Option('--mnemonic <mnemonic>');
export const interactiveOption = new Option('-i, --interactive');
export const srcOption = new Option('--src <chain>');
export const destOption = new Option('--dest <chain>');
