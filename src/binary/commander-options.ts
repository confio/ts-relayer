import commander, { Option } from 'commander';

import { levels } from './create-logger';

export const homeOption = new Option(
  '--home <path>',
  "Path to relayer's home (default: $HOME/.ibc-setup)"
);
export const keyFileOption = (type: 'read' | 'write') =>
  new Option(
    '--key-file <path>',
    `Path to file to ${
      type === 'read' ? 'read mnemonic from' : 'write mnemonic to'
    }`
  );
export const mnemonicOption = new Option(
  '--mnemonic <mnemonic>',
  'BIP39 mnemonic'
);
export const interactiveOption = new Option(
  '-i, --interactive',
  'Read mnemonic from stdin'
);
export const srcOption = new Option(
  '--src <chain>',
  'Source chain from the registry'
);
export const destOption = new Option(
  '--dest <chain>',
  'Destination chain from the registry'
);
export const chainOption = new Option(
  '--chain <chain>',
  'Chain to run query against'
);
export const srcTrust = new Option(
  '--src-trust <seconds>',
  'Trusting period for source connection'
);
export const destTrust = new Option(
  '--dest-trust <seconds>',
  'Trusting period for destination connection'
);
export const srcConnection = new Option(
  '--src-connection <connection>',
  'Source connection id'
);
export const destConnection = new Option(
  '--dest-connection <connection>',
  'Destination connection id'
);
export const srcPort = new Option(
  '--src-port <port>',
  'Source port to create channel'
);
export const destPort = new Option(
  '--dest-port <port>',
  'Destination port to create channel'
);

export const addLoggerOptionsTo = (command: commander.Command) => {
  return command
    .addOption(
      new Option('--log-level <level>', 'Set log level').choices(
        Object.keys(levels)
      )
    )
    .option('-v, --verbose', 'Alias for "--log-level verbose"')
    .option('-q, --quiet', 'Alias for "--log-level error"')
    .option('--log-file <path>', 'Path to file to write logs to');
};

export const helpOptions = ['-h, --help', 'Display help command'];
