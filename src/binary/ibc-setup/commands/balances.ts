import path from 'path';

import { GasPrice } from '@cosmjs/launchpad';
import { Decimal } from '@cosmjs/math';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

import { IbcClient } from '../../../lib/ibcclient';
import { registryFile } from '../../constants';
import { getDefaultHomePath } from '../utils/get-default-home-path';
import { loadAndValidateApp } from '../utils/load-and-validate-app';
import { loadAndValidateRegistry } from '../utils/load-and-validate-registry';
import { resolveMnemonicOption } from '../utils/resolve-mnemonic-option';
import { resolveOption } from '../utils/resolve-option';
import { resolveRequiredOption } from '../utils/resolve-required-option';

import { Flags, getAddresses, Options } from './keys-list';

export async function balances(flags: Flags) {
  const home = resolveRequiredOption('home')(
    flags.home,
    process.env.RELAYER_HOME,
    getDefaultHomePath
  );
  const app = loadAndValidateApp(home);

  const keyFile = resolveOption(
    flags.keyFile,
    app?.keyFile,
    process.env.KEY_FILE
  );

  const options: Options = {
    home,
    mnemonic: await resolveMnemonicOption({
      interactive: flags.interactive,
      mnemonic: flags.mnemonic,
      keyFile: keyFile,
      app,
    }),
  };

  await run(options);
}

export async function run(options: Options) {
  const registryFilePath = path.join(options.home, registryFile);
  const registry = loadAndValidateRegistry(registryFilePath);

  const addresses = await getAddresses(registry.chains, options.mnemonic);

  for (const [chain, data, address] of addresses) {
    const signer = await DirectSecp256k1HdWallet.fromMnemonic(
      options.mnemonic,
      undefined,
      data.prefix
    );

    const gasPrice = GasPrice.fromString(data.gas_price);

    const client = await IbcClient.connectWithSigner(
      data.rpc[0], // rpc[0] is guaranteed to be defined by registry validator
      signer,
      address,
      {
        prefix: data.prefix,
        gasPrice,
      }
    );

    const balances = await client.query.bank.unverified.allBalances(address);

    console.log(chain, balances);
  }
}
