import fs from 'fs';
import os from 'os';
import path from 'path';

import { Bip39, Random, stringToPath } from '@cosmjs/crypto';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import Ajv, { JSONSchemaType } from 'ajv';
import axios from 'axios';
import yaml from 'js-yaml';

import { GlobalOptions } from '../types';
import { resolveOption } from '../utils/resolve-option';

export type Options = GlobalOptions & {
  readonly src: string;
  readonly dest: string;
};

type Chain = {
  chain_id: string;
  prefix: string;
  gas_price: string;
  hd_path: string;
  rpc: string[];
};

type Registry = {
  version: number;
  chains: Record<string, Chain>;
};

const registryFile = 'registry.yaml';
const appFile = 'app.yaml';

function generateMnemonic(): string {
  return Bip39.encode(Random.getBytes(16)).toString();
}

async function deriveAddress(
  mnemomic: string,
  prefix: string,
  path: string
): Promise<string> {
  const hdpath = stringToPath(path);
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
    mnemomic,
    hdpath,
    prefix
  );
  const accounts = await wallet.getAccounts();
  return accounts[0].address;
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

  const registry = yaml.load(fs.readFileSync(registryFilePath, 'utf-8'));

  const ajv = new Ajv({ allErrors: true });
  const schema: JSONSchemaType<Registry> = {
    type: 'object',
    required: ['chains', 'version'],
    additionalProperties: false,
    properties: {
      version: {
        type: 'number',
      },
      chains: {
        type: 'object',
        minProperties: 2,
        required: [],
        additionalProperties: false,
        patternProperties: {
          '^(.*)$': {
            type: 'object',
            required: ['chain_id', 'gas_price', 'hd_path', 'prefix', 'rpc'],
            additionalProperties: false,
            properties: {
              chain_id: { type: 'string' },
              prefix: { type: 'string' },
              gas_price: { type: 'string' },
              hd_path: { type: 'string' },
              rpc: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  };
  const validate = ajv.compile(schema);
  if (!validate(registry)) {
    const errors = (validate.errors ?? []).map(
      ({ dataPath, message }) => `"${dataPath}" ${message}`
    );
    throw new Error(
      [`${registryFile} validation failed.`, ...errors].join(os.EOL)
    );
  }

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
