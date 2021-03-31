import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';
import { Logger } from 'winston';

import { Order } from '../../../codec/ibc/core/channel/v1/channel';
import { IbcClient } from '../../../lib/ibcclient';
import { Link } from '../../../lib/link';
import { appFile, registryFile } from '../../constants';
import { AppConfig } from '../../types';
import { loadAndValidateApp } from '../../utils/load-and-validate-app';
import { loadAndValidateRegistry } from '../../utils/load-and-validate-registry';
import { resolveOption } from '../../utils/options/resolve-option';
import { resolveHomeOption } from '../../utils/options/shared/resolve-home-option';
import { resolveKeyFileOption } from '../../utils/options/shared/resolve-key-file-option';
import { resolveMnemonicOption } from '../../utils/options/shared/resolve-mnemonic-option';
import { signingClient } from '../../utils/signing-client';

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
  readonly srcTrust?: string;
  readonly destTrust?: string;
};

export type Options = {
  readonly home: string;
  readonly mnemonic: string;
  readonly src: string;
  readonly dest: string;
  readonly srcPort: string | null;
  readonly destPort: string | null;
  readonly srcTrust: number | null;
  readonly destTrust: number | null;
  readonly connections: Connections;
};

const defaultPort = 'transfer';

function resolveConnections({
  srcConnection,
  destConnection,
}: AppConfig): Connections {
  if (!srcConnection && destConnection) {
    throw new Error(
      `You have defined "destConnection" but no "srcConnection". Both "srcConnection" and "destConnection" must be present.`
    );
  }

  if (srcConnection && !destConnection) {
    throw new Error(
      `You have defined "srcConnection" but no "destConnection". Both "srcConnection" and "destConnection" must be present.`
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

export async function ics20(flags: Flags, logger: Logger): Promise<void> {
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
  const src = resolveOption('src', { required: true })(
    flags.src,
    app.src,
    process.env.RELAYER_SRC
  );
  const dest = resolveOption('dest', { required: true })(
    flags.dest,
    app.dest,
    process.env.RELAYER_DEST
  );
  // we apply default ports later, once we have the registry
  const srcPort = resolveOption('srcPort')(
    flags.srcPort,
    process.env.RELAYER_SRC_PORT
  );
  const destPort = resolveOption('destPort')(
    flags.destPort,
    process.env.RELAYER_DEST_PORT
  );
  const srcTrust = resolveOption('srcTrust', { integer: true })(
    flags.srcTrust,
    process.env.RELAYER_SRC_TRUST
  );
  const destTrust = resolveOption('destTrust', { integer: true })(
    flags.destTrust,
    process.env.RELAYER_DEST_TRUST
  );
  const connections = resolveConnections(app);

  run(
    {
      src,
      dest,
      home,
      mnemonic,
      srcPort,
      destPort,
      connections,
      srcTrust,
      destTrust,
    },
    app,
    logger
  );
}

async function resolveLink(
  nodeA: IbcClient,
  nodeB: IbcClient,
  { connections, srcTrust, destTrust }: Options,
  logger: Logger
) {
  if (connections) {
    const link = await Link.createWithExistingConnections(
      nodeA,
      nodeB,
      connections.src,
      connections.dest,
      logger
    );
    logger.info(
      `Used existing connections ${link.endA.connectionID} (${link.endA.clientID}) <=> ${link.endB.connectionID} (${link.endB.clientID})`
    );
    return link;
  }

  const link = await Link.createWithNewConnections(
    nodeA,
    nodeB,
    logger,
    srcTrust,
    destTrust
  );
  logger.info(
    `Created connections ${link.endA.connectionID} (${link.endA.clientID}) <=> ${link.endB.connectionID} (${link.endB.clientID})`
  );
  return link;
}

export async function run(
  options: Options,
  app: AppConfig,
  logger: Logger
): Promise<void> {
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

  const nodeA = await signingClient(srcChain, options.mnemonic, logger);
  const nodeB = await signingClient(destChain, options.mnemonic, logger);
  const link = await resolveLink(nodeA, nodeB, options, logger);

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

  // provide default port, either from registry or global default
  const srcPort = resolveOption('src-port', { required: true })(
    options.srcPort,
    srcChain.ics20_port,
    defaultPort
  );
  const destPort = resolveOption('dest-port', { required: true })(
    options.destPort,
    destChain.ics20_port,
    defaultPort
  );

  const channels = await link.createChannel(
    'A',
    srcPort,
    destPort,
    ordering,
    version
  );

  logger.info(
    `Created channels for connections ${link.endA.connectionID} <=> ${link.endB.connectionID}: ${channels.src.channelId} (${channels.src.portId}) => ${channels.dest.channelId} (${channels.dest.portId})`
  );
}
