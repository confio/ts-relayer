import fs from 'fs';

import { generateMnemonic } from '../utils/generate-mnemonic';
import { resolveOption } from '../utils/resolve-option';

export type Options = {
  keyFile?: string;
};

export function keysGenerate(flags: Options) {
  const options = {
    keyFile: resolveOption(
      'key-file',
      flags.keyFile,
      process.env.RELAYER_KEY_FILE
    ),
  };

  run(options);
}

export function run(options: Options) {
  const mnemonic = generateMnemonic();

  if (options.keyFile) {
    fs.writeFileSync(options.keyFile, mnemonic, 'utf-8');
    console.log(`Saved mnemonic to ${options.keyFile}`);
    return;
  }

  console.log(mnemonic);
}
