import os from "os";
import path from "path";

import { registryFile } from "../../constants";
import { Logger } from "../../create-logger";
import { Chain } from "../../types";
import { deriveAddress } from "../../utils/derive-address";
import { loadAndValidateApp } from "../../utils/load-and-validate-app";
import { loadAndValidateRegistry } from "../../utils/load-and-validate-registry";
import { resolveHomeOption } from "../../utils/options/shared/resolve-home-option";
import { resolveKeyFileOption } from "../../utils/options/shared/resolve-key-file-option";
import { resolveMnemonicOption } from "../../utils/options/shared/resolve-mnemonic-option";

export type Flags = {
  readonly interactive: boolean;
  readonly home?: string;
  readonly keyFile?: string;
  readonly mnemonic?: string;
};

export type Options = {
  readonly home: string;
  readonly mnemonic: string;
};

export async function keysList(flags: Flags, _logger: Logger) {
  const home = resolveHomeOption({ homeFlag: flags.home });
  const app = loadAndValidateApp(home);
  const keyFile = resolveKeyFileOption({ keyFileFlag: flags.keyFile, app });
  const mnemonic = await resolveMnemonicOption({
    interactiveFlag: flags.interactive,
    mnemonicFlag: flags.mnemonic,
    keyFile,
    app,
  });

  const options: Options = {
    home,
    mnemonic,
  };

  await run(options);
}

export async function getAddresses(
  registryChains: Record<string, Chain>,
  mnemonic: string,
): Promise<[chain: string, data: Chain, address: string][]> {
  const chains = Object.entries(registryChains);

  return (
    await Promise.all(
      chains.map(([, data]) =>
        deriveAddress(mnemonic, data.prefix, data.hd_path),
      ),
    )
  ).map((address, index) => [chains[index][0], chains[index][1], address]);
}

export async function run(options: Options) {
  const registryFilePath = path.join(options.home, registryFile);
  const registry = loadAndValidateRegistry(registryFilePath);

  const addresses = (await getAddresses(registry.chains, options.mnemonic))
    .map(([chain, , address]) => `${chain}: ${address}`)
    .join(os.EOL);

  console.log(addresses);
}
