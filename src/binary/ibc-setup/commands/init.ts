import fs from 'fs';
import path from 'path';

import { Bip39, Random } from '@cosmjs/crypto';
import axios from 'axios';
import yaml from 'js-yaml';

import { GlobalOptions } from '../types';
import { resolveOption } from '../utils/resolve-option';

export type Options = GlobalOptions & {
  readonly src: string;
  readonly dest: string;
};

const registryFile = 'registry.yaml';
const appFile = 'app.yaml';

export function generateMnemonic(): string {
  return Bip39.encode(Random.getBytes(16)).toString();
}

export function init(flags: Partial<Options>) {
  function getDefaultHome() {
    if (!process.env.HOME) {
      throw new Error('$HOME environment variable is not set.');
    }

    return `${process.env.HOME}/.ibc-setup`;
  }

  const options = {
    src: resolveOption('src', flags.src, process.env.RELAYER_SRC),
    dest: resolveOption('dest', flags.dest, process.env.RELAYER_DEST),
    home: resolveOption('home', flags.home, getDefaultHome),
  };

  run(options);
}

export async function run(options: Options) {
  console.log(generateMnemonic());
  const appFilePath = path.join(options.home, appFile);
  if (fs.existsSync(appFilePath)) {
    console.log(`The ${appFile} is already initialized at ${options.home}`);
    return;
  }

  if (!fs.existsSync(options.home)) {
    fs.mkdirSync(options.home, { recursive: true });
    console.log(`Initialized home directory at ${options.home}`);
  } else if (!fs.lstatSync(options.home).isDirectory()) {
    throw new Error(`${options.home} must be a directory.`);
  }

  const registryFilePath = path.join(options.home, registryFile);
  if (!fs.existsSync(registryFilePath)) {
    try {
      const registryFromRemote = await axios.get(
        'https://raw.githubusercontent.com/confio/ts-relayer/main/demo/registry.yaml'
      );
      fs.writeFileSync(registryFilePath, registryFromRemote.data);
    } catch (error) {
      throw new Error(`Cannot fetch ${registryFile} from remote. ${error}`);
    }
  } else if (!fs.lstatSync(registryFilePath).isFile()) {
    throw new Error(`${registryFilePath} must be a file.`);
  }

  yaml.load(fs.readFileSync(registryFilePath, 'utf-8'));
  // TODO #75: registry file validation

  const appYaml = yaml.dump({
    src: options.src,
    dest: options.dest,
    mnemonic: generateMnemonic(),
  });

  fs.writeFileSync(appFilePath, appYaml, { encoding: 'utf-8' });
  console.log(`Saved configuration to ${appFilePath}`);
}
