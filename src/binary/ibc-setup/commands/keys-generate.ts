import fs from 'fs';

import { Logger } from 'winston';

import { generateMnemonic } from '../../utils/generate-mnemonic';
import { resolveOption } from '../../utils/options/resolve-option';

export type Flags = {
  readonly keyFile?: string;
};

export type Options = {
  readonly keyFile: string | null;
};

export async function keysGenerate(flags: Flags, logger: Logger) {
  const options = {
    keyFile: resolveOption('keyFile')(
      flags.keyFile,
      process.env.RELAYER_KEY_FILE
    ),
  };

  await run(options, logger);
}

export function run(options: Options, logger: Logger) {
  const mnemonic = generateMnemonic();

  if (options.keyFile) {
    fs.writeFileSync(options.keyFile, mnemonic, 'utf-8');
    logger.info(`Saved mnemonic to ${options.keyFile}`);
    return;
  }

  logger.info(mnemonic);
}
