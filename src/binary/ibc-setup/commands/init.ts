import fs from 'fs';
import path from 'path';

import { Command } from 'commander';
import yaml from 'js-yaml';

import { GlobalOptions } from '../types';

type Options = GlobalOptions & {
  src: string;
  dest: string;
};

type ProgramOptions = Partial<Options>;

function resolveHome(home?: string) {
  if (home) {
    return home;
  }

  if (!process.env.HOME) {
    throw new Error('$HOME environment variable is not set.');
  }

  return `${process.env.HOME}/.ibc-setup`;
}

const REGISTRY_FILE = 'registry.yaml';

export function init(_: unknown, program: Command) {
  const programOptions: ProgramOptions = program.opts();

  // TODO: Resolve options with precedence (env, command line etc.)
  const options = {
    src: programOptions.src ?? 'src',
    dest: programOptions.dest ?? 'dest',
    home: resolveHome(programOptions.home),
  };

  run(options);
}

function run(options: Options) {
  if (!fs.existsSync(options.home)) {
    fs.mkdirSync(options.home, { recursive: true });
    console.log(`Initialized home directory at ${options.home}`);
  } else if (!fs.lstatSync(options.home).isDirectory()) {
    throw new Error(`${options.home} must be a directory. It is a file.`);
  }

  const REGISTRY_FILE_PATH = path.join(options.home, REGISTRY_FILE);
  if (!fs.existsSync(REGISTRY_FILE_PATH)) {
    // TODO: download registry.yaml from default location
  } else if (!fs.lstatSync(REGISTRY_FILE_PATH).isFile()) {
    throw new Error(`${REGISTRY_FILE_PATH} must be a file. It is a directory.`);
  }

  try {
    const registry = yaml.load(fs.readFileSync(REGISTRY_FILE_PATH, 'utf-8'));

    // TODO: registry validation?
    console.log(registry);
  } catch (error) {
    throw new Error(error);
  }
}
