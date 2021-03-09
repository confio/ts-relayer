import fs from 'fs';

import { generateMnemonic } from '../../utils/generate-mnemonic';
import { resolveOption } from '../../utils/options/resolve-option';

export type Flags = {
  readonly keyFile?: string;
};

export type Options = {
  readonly keyFile: string | null;
};

export function keysGenerate(flags: Flags) {
  const options = {
    keyFile: resolveOption(flags.keyFile, process.env.RELAYER_KEY_FILE),
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
