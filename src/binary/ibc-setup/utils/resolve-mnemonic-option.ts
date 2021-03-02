import fs from 'fs';
import readline from 'readline';

import { App } from '../types';

import { resolveRequiredOption } from './resolve-required-option';

async function readMnemonicFromStdin(interactive: boolean) {
  if (!interactive) {
    return null;
  }

  const readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const mnemonic = await new Promise<string>((resolve) => {
    readlineInterface.question('enter mnemonic phrase: ', (stdin) => {
      readlineInterface.close();
      resolve(stdin);
    });
  });

  return mnemonic;
}

function readMnemonicFromFile(keyFile: string | null) {
  if (!keyFile) {
    return null;
  }

  return () => {
    return fs.readFileSync(keyFile, 'utf-8').trim();
  };
}

type Params = {
  interactive: boolean;
  mnemonic?: string;
  keyFile: string | null;
  app: App | null;
};

export async function resolveMnemonicOption({
  interactive,
  keyFile,
  mnemonic: mnemonicFlag,
  app,
}: Params) {
  return resolveRequiredOption('mnemonic')(
    await readMnemonicFromStdin(interactive),
    mnemonicFlag,
    app?.mnemonic,
    process.env.RELAYER_MNEMONIC,
    readMnemonicFromFile(keyFile)
  );
}
