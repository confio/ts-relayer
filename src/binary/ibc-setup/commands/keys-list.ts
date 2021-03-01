import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';

import { registryFile } from '../../constants';
import { deriveAddress } from '../utils/derive-address';
import { getDefaultHomePath } from '../utils/get-default-home-path';
import { loadAndValidateRegistry } from '../utils/load-and-validate-registry';
import { resolveRequiredOption } from '../utils/resolve-required-option';

type Flags = {
  readonly interactive: boolean;
  readonly home?: string;
  readonly keyFile?: string;
  readonly mnemonic?: string;
};

type Options = {
  readonly home: string;
  readonly mnemonic: string;
};

export async function readMnemonicFromStdin(interactive: Flags['interactive']) {
  if (!interactive) {
    return undefined;
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

function readMnemonicFromFile(keyFile: Flags['keyFile']) {
  if (!keyFile) {
    return undefined;
  }

  return () => {
    return fs.readFileSync(keyFile, 'utf-8').trim();
  };
}

export async function keysList(flags: Flags) {
  const options: Options = {
    home: resolveRequiredOption('home')(
      flags.home,
      process.env.RELAYER_HOME,
      getDefaultHomePath
    ),
    mnemonic: resolveRequiredOption('mnemonic')(
      await readMnemonicFromStdin(flags.interactive),
      flags.mnemonic,
      readMnemonicFromFile(flags.keyFile),
      process.env.RELAYER_MNEMONIC
    ),
  };

  await run(options);
}

export async function run(options: Options) {
  const registryFilePath = path.join(options.home, registryFile);
  const registry = loadAndValidateRegistry(registryFilePath);

  const chains = Object.entries(registry.chains);

  const addresses = (
    await Promise.all(
      chains.map(([, data]) =>
        deriveAddress(options.mnemonic, data.prefix, data.hd_path)
      )
    )
  )
    .map((address, index) => {
      const chain = chains[index][0];

      return `${chain}: ${address}`;
    })
    .join(os.EOL);

  console.log(addresses);
}
