import path from 'path';

import { GasPrice } from '@cosmjs/launchpad';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

import { IbcClient } from '../../../lib/ibcclient';
import { registryFile } from '../../constants';
import { loadAndValidateApp } from '../utils/load-and-validate-app';
import { loadAndValidateRegistry } from '../utils/load-and-validate-registry';
import { resolveHomeOption } from '../utils/options/shared/resolve-home-option';
import { resolveKeyFileOption } from '../utils/options/shared/resolve-key-file-option';
import { resolveMnemonicOption } from '../utils/options/shared/resolve-mnemonic-option';

import { Flags, getAddresses, Options } from './keys-list';

export async function balances(flags: Flags) {
  const home = resolveHomeOption({ homeFlag: flags.home });
  const app = loadAndValidateApp(home);
  const keyFile = resolveKeyFileOption({ keyFileFlag: flags.keyFile, app });
  const mnemonic = await resolveMnemonicOption({
    interactiveFlag: flags.interactive,
    mnemonicFlag: flags.mnemonic,
    keyFile: keyFile,
    app,
  });

  const options: Options = {
    home,
    mnemonic,
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
