import fs from 'fs';
import path from 'path';

import { Command } from 'commander';
import yaml from 'js-yaml';

import { GlobalOptions } from '../types';
import { resolveOption } from '../utils/resolve-option';
import axios from 'axios';

export type Options = GlobalOptions & {
  src: string;
  dest: string;
};

type ProgramOptions = Partial<Options>;

const REGISTRY_FILE = 'registry.yaml';

export function init(_: unknown, program: Command) {
  const programOptions: ProgramOptions = program.opts();

  function getDefaultHome() {
    if (!process.env.HOME) {
      throw new Error('$HOME environment variable is not set.');
    }

    return `${process.env.HOME}/.ibc-setup`;
  }

  const options = {
    src: resolveOption('src', programOptions.src, process.env.RELAYER_SRC),
    dest: resolveOption('dest', programOptions.dest, process.env.RELAYER_DEST),
    home: resolveOption('home', programOptions.home, getDefaultHome),
  };

  run(options);
}

export async function run(options: Options) {
  if (!fs.existsSync(options.home)) {
    fs.mkdirSync(options.home, { recursive: true });
    console.log(`Initialized home directory at ${options.home}`);
  } else if (!fs.lstatSync(options.home).isDirectory()) {
    throw new Error(`${options.home} must be a directory. It is a file.`);
  }

  const REGISTRY_FILE_PATH = path.join(options.home, REGISTRY_FILE);
  if (!fs.existsSync(REGISTRY_FILE_PATH)) {
    const registryFromRemote = await axios.get(
      'https://raw.githubusercontent.com/confio/ts-relayer/main/demo/registry.yaml'
    );
    fs.writeFileSync(REGISTRY_FILE_PATH, registryFromRemote.data, {
      encoding: 'utf-8',
    });
  } else if (!fs.lstatSync(REGISTRY_FILE_PATH).isFile()) {
    throw new Error(`${REGISTRY_FILE_PATH} must be a file. It is a directory.`);
  }

  const registry = yaml.load(fs.readFileSync(REGISTRY_FILE_PATH, 'utf-8'));
  // TODO #75: registry file validation
  console.log(registry);
}
