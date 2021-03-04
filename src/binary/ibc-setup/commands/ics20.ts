import path from 'path';

import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

import { Order } from '../../../codec/ibc/core/channel/v1/channel';
import { IbcClient } from '../../../lib/ibcclient';
import { Link } from '../../../lib/link';
import { registryFile } from '../../constants';
import { Chain } from '../types';
import { getDefaultHomePath } from '../utils/get-default-home-path';
import { loadAndValidateApp } from '../utils/load-and-validate-app';
import { loadAndValidateRegistry } from '../utils/load-and-validate-registry';
import { resolveMnemonicOption } from '../utils/resolve-mnemonic-option';
import { resolveOption } from '../utils/resolve-option';
import { resolveRequiredOption } from '../utils/resolve-required-option';

export type Flags = {
  readonly interactive: boolean;
  readonly home?: string;
  readonly keyFile?: string;
  readonly mnemonic?: string;
  readonly src?: string;
  readonly dest?: string;
  readonly srcPort?: string;
  readonly destPort: string;
};

export type Options = {
  readonly home: string;
  readonly mnemonic: string;
  readonly src: string;
  readonly dest: string;
  readonly srcPort: string;
  readonly destPort: string;
};

const defaultPort = 'transfer';

export async function ics20(flags: Flags): Promise<void> {
  const home = resolveRequiredOption('home')(
    flags.home,
    process.env.RELAYER_HOME,
    getDefaultHomePath
  );
  const appConfig = loadAndValidateApp(home);
  const keyFile = resolveOption(
    flags.keyFile,
    process.env.KEY_FILE,
    appConfig?.keyFile
  );
  const mnemonic = await resolveMnemonicOption({
    interactive: flags.interactive,
    mnemonic: flags.mnemonic,
    keyFile,
    app: appConfig,
  });
  const src = resolveRequiredOption('src')(flags.src, process.env.RELAYER_SRC);
  const dest = resolveRequiredOption('dest')(
    flags.dest,
    process.env.RELAYER_DEST
  );
  const srcPort =
    resolveOption(flags.srcPort, process.env.RELAYER_SRC_PORT) ?? defaultPort;
  const destPort =
    resolveOption(flags.destPort, process.env.RELAYER_DEST_PORT) ?? defaultPort;

  run({
    src,
    dest,
    home,
    mnemonic,
    srcPort,
    destPort,
  });
}

export async function run(options: Options): Promise<void> {
  const registryFilePath = path.join(options.home, registryFile);
  const { chains } = loadAndValidateRegistry(registryFilePath);
  const srcChain = chains[options.src];
  if (srcChain === undefined) {
    throw new Error('src chain not found in registry');
  }
  const destChain = chains[options.dest];
  if (destChain === undefined) {
    throw new Error('dest chain not found in registry');
  }
  const ordering = Order.ORDER_UNORDERED;
  const version = 'ics20-1';

  const nodeA = await createClient(options.mnemonic, srcChain);
  const nodeB = await createClient(options.mnemonic, destChain);
  const link = await Link.createWithNewConnections(nodeA, nodeB);

  const channels = await link.createChannel(
    'A',
    options.srcPort,
    options.destPort,
    ordering,
    version
  );
  console.log(channels);

  throw new Error('not implemented');
}

async function createClient(
  mnemonic: string,
  { prefix, rpc }: Chain
): Promise<IbcClient> {
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(
    mnemonic,
    undefined,
    prefix
  );
  const [{ address }] = await signer.getAccounts();
  return IbcClient.connectWithSigner(rpc[0], signer, address);
}
