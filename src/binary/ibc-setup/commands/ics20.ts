import fs from 'fs';
import path from 'path';

import { stringToPath } from '@cosmjs/crypto';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import yaml from 'js-yaml';

import { Order } from '../../../codec/ibc/core/channel/v1/channel';
import { IbcClient } from '../../../lib/ibcclient';
import { Link } from '../../../lib/link';
import { appFile, registryFile } from '../../constants';
import { AppConfig, Chain } from '../types';
import { loadAndValidateApp } from '../utils/load-and-validate-app';
import { loadAndValidateRegistry } from '../utils/load-and-validate-registry';
import { resolveOption } from '../utils/options/resolve-option';
import { resolveRequiredOption } from '../utils/options/resolve-required-option';
import { resolveHomeOption } from '../utils/options/shared/resolve-home-option';
import { resolveKeyFileOption } from '../utils/options/shared/resolve-key-file-option';
import { resolveMnemonicOption } from '../utils/options/shared/resolve-mnemonic-option';

type Connections = {
  src: string;
  dest: string;
} | null;

export type Flags = {
  readonly interactive: boolean;
  readonly home?: string;
  readonly keyFile?: string;
  readonly mnemonic?: string;
  readonly src?: string;
  readonly dest?: string;
  readonly srcPort?: string;
  readonly destPort?: string;
  readonly srcConnection?: string;
  readonly destConnection?: string;
};

export type Options = {
  readonly home: string;
  readonly mnemonic: string;
  readonly src: string;
  readonly dest: string;
  readonly srcPort: string;
  readonly destPort: string;
  readonly connections: Connections;
};

const defaultPort = 'transfer';

function resolveConnections(
  srcConnection: string | null,
  destConnection: string | null
): Connections {
  if (!srcConnection && destConnection) {
    throw new Error(
      `You have defined "destConnection" but no "srcConnection". Please define "srcConnection" and "destConnection" at the same time.`
    );
  }

  if (srcConnection && !destConnection) {
    throw new Error(
      `You have defined "srcConnection" but no "destConnection". Please define "srcConnection" and "destConnection" at the same time.`
    );
  }

  if (srcConnection && destConnection) {
    return {
      src: srcConnection,
      dest: destConnection,
    };
  }

  return null;
}

export async function ics20(flags: Flags): Promise<void> {
  const home = resolveHomeOption({ homeFlag: flags.home });
  const app = loadAndValidateApp(home);

  if (!app) {
    throw new Error(`${appFile} not found at ${home}`);
  }

  const keyFile = resolveKeyFileOption({ keyFileFlag: flags.keyFile, app });
  const mnemonic = await resolveMnemonicOption({
    interactiveFlag: flags.interactive,
    mnemonicFlag: flags.mnemonic,
    keyFile,
    app,
  });
  const src = resolveRequiredOption('src')(flags.src, process.env.RELAYER_SRC);
  const dest = resolveRequiredOption('dest')(
    flags.dest,
    process.env.RELAYER_DEST
  );
  const srcPort = resolveRequiredOption('srcPort')(
    flags.srcPort,
    process.env.RELAYER_SRC_PORT,
    defaultPort
  );
  const destPort = resolveRequiredOption('destPort')(
    flags.destPort,
    process.env.RELAYER_DEST_PORT,
    defaultPort
  );
  const srcConnection = resolveOption(
    flags.srcConnection,
    app.srcConnection,
    process.env.RELAYER_SRC_CONNECTION
  );
  const destConnection = resolveOption(
    flags.destConnection,
    app.destConnection,
    process.env.RELAYER_DEST_CONNECTION
  );

  const connections = resolveConnections(srcConnection, destConnection);

  run(
    {
      src,
      dest,
      home,
      mnemonic,
      srcPort,
      destPort,
      connections,
    },
    app
  );
}

async function resolveLink(
  nodeA: IbcClient,
  nodeB: IbcClient,
  connections: Connections
) {
  if (connections) {
    const link = await Link.createWithExistingConnections(
      nodeA,
      nodeB,
      connections.src,
      connections.dest
    );
    console.log(
      `Used existing connections ${link.endA.connectionID} (${link.endA.clientID}) <=> ${link.endB.connectionID} (${link.endB.clientID})`
    );
    return link;
  }

  const link = await Link.createWithNewConnections(nodeA, nodeB);
  console.log(
    `Created connections ${link.endA.connectionID} (${link.endA.clientID}) <=> ${link.endB.connectionID} (${link.endB.clientID})`
  );
  return link;
}

export async function run(options: Options, app: AppConfig): Promise<void> {
  const registryFilePath = path.join(options.home, registryFile);
  const { chains } = loadAndValidateRegistry(registryFilePath);
  const srcChain = chains[options.src];
  if (!srcChain) {
    throw new Error('src chain not found in registry');
  }
  const destChain = chains[options.dest];
  if (!destChain) {
    throw new Error('dest chain not found in registry');
  }
  const ordering = Order.ORDER_UNORDERED;
  const version = 'ics20-1';

  const nodeA = await createClient(options.mnemonic, srcChain);
  const nodeB = await createClient(options.mnemonic, destChain);
  const link = await resolveLink(nodeA, nodeB, options.connections);

  const srcConnection = link.endA.connectionID;
  const destConnection = link.endB.connectionID;
  const appFilePath = path.join(options.home, appFile);
  const appYaml = yaml.dump(
    {
      ...app,
      srcConnection,
      destConnection,
    },
    {
      lineWidth: 1000,
    }
  );

  fs.writeFileSync(appFilePath, appYaml, { encoding: 'utf-8' });

  const channels = await link.createChannel(
    'A',
    options.srcPort,
    options.destPort,
    ordering,
    version
  );

  console.log(
    `Created channels for connections ${link.endA.connectionID} <=> ${link.endB.connectionID}: ${channels.src.channelId} (${channels.src.portId}) => ${channels.dest.channelId} (${channels.dest.portId})`
  );
}

export async function createClient(
  mnemonic: string,
  { prefix, rpc, hd_path }: Pick<Chain, 'prefix' | 'rpc' | 'hd_path'>
): Promise<IbcClient> {
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(
    mnemonic,
    hd_path ? stringToPath(hd_path) : undefined,
    prefix
  );
  const [{ address }] = await signer.getAccounts();
  return IbcClient.connectWithSigner(rpc[0], signer, address);
}
