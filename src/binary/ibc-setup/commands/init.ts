import fs from 'fs';
import path from 'path';

import axios from 'axios';
import yaml from 'js-yaml';

import { appFile, registryFile } from '../../constants';
import { deriveAddress } from '../utils/derive-address';
import { generateMnemonic } from '../utils/generate-mnemonic';
import { getDefaultHomePath } from '../utils/get-default-home-path';
import { loadAndValidateRegistry } from '../utils/load-and-validate-registry';
import { resolveRequiredOption } from '../utils/resolve-required-option';

export type Flags = {
  readonly home?: string;
  readonly src?: string;
  readonly dest?: string;
};

export type Options = Required<Flags>;

export function init(flags: Flags) {
  const options = {
    src: resolveRequiredOption('src')(flags.src, process.env.RELAYER_SRC),
    dest: resolveRequiredOption('dest')(flags.dest, process.env.RELAYER_DEST),
    home: resolveRequiredOption('home')(
      flags.home,
      process.env.RELAYER_HOME,
      getDefaultHomePath
    ),
  };

  run(options);
}

export async function run(options: Options) {
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

  const registry = loadAndValidateRegistry(registryFilePath);

  const [chainSrc, chainDest] = [options.src, options.dest].map((chain) => {
    const chainData = registry.chains[chain];

    if (!chainData) {
      throw new Error(
        `Chain ${chain} is missing in the registry, either check the spelling or add the chain definition to ${registryFilePath}`
      );
    }

    return chainData;
  });

  const mnemonic = generateMnemonic();

  const appYaml = yaml.dump(
    {
      src: options.src,
      dest: options.dest,
      mnemonic,
    },
    {
      lineWidth: 1000, // to ensure mnemonic is not split on multiple lines
    }
  );

  fs.writeFileSync(appFilePath, appYaml, { encoding: 'utf-8' });
  console.log(`Saved configuration to ${appFilePath}`);

  const [addressSrc, addressDest] = await Promise.all([
    deriveAddress(mnemonic, chainSrc.prefix, chainSrc.hd_path),
    deriveAddress(mnemonic, chainDest.prefix, chainDest.hd_path),
  ]);
  console.log(`Source address: ${addressSrc}`);
  console.log(`Destination address: ${addressDest}`);
}
