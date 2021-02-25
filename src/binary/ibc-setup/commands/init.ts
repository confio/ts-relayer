import fs from 'fs';
import path from 'path';

import axios from 'axios';
import yaml from 'js-yaml';

import { GlobalOptions } from '../types';
import { resolveOption } from '../utils/resolve-option';

export type Options = GlobalOptions & {
  readonly src: string;
  readonly dest: string;
};

const registryFile = 'registry.yaml';

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
      fs.writeFileSync(registryFilePath, registryFromRemote.data, {
        encoding: 'utf-8',
      });
    } catch (error) {
      throw new Error(`Cannot fetch ${registryFile} from remote. ${error}`);
    }
  } else if (!fs.lstatSync(registryFilePath).isFile()) {
    throw new Error(`${registryFilePath} must be a file.`);
  }

  const registry = yaml.load(fs.readFileSync(registryFilePath, 'utf-8'));
  // TODO #75: registry file validation
  console.log(registry);
}
