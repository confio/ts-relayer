import path from "path";

import { GasPrice } from "@cosmjs/stargate";
import { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";

import { registryFile } from "../../constants";
import { Logger } from "../../create-logger";
import { borderlessTable } from "../../utils/borderless-table";
import { loadAndValidateApp } from "../../utils/load-and-validate-app";
import { loadAndValidateRegistry } from "../../utils/load-and-validate-registry";
import { resolveHomeOption } from "../../utils/options/shared/resolve-home-option";
import { resolveKeyFileOption } from "../../utils/options/shared/resolve-key-file-option";
import { resolveMnemonicOption } from "../../utils/options/shared/resolve-mnemonic-option";
import { signingClient } from "../../utils/signing-client";

import { Flags, getAddresses, Options } from "./keys-list";

export async function balances(flags: Flags, logger: Logger) {
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

  await run(options, logger);
}

export async function run(options: Options, logger: Logger) {
  const registryFilePath = path.join(options.home, registryFile);
  const registry = loadAndValidateRegistry(registryFilePath);

  const addresses = await getAddresses(registry.chains, options.mnemonic);

  const balances = (
    await Promise.allSettled(
      addresses.map(async ([chain, data, address]) => {
        const client = await signingClient(
          data,
          options.mnemonic,
          logger.child({ label: chain }),
        );
        const gasPrice = GasPrice.fromString(data.gas_price);
        const coin = await client.query.bank.balance(address, gasPrice.denom);
        return [chain, coin];
      }),
    )
  )
    .filter((result): result is PromiseFulfilledResult<[string, Coin]> => {
      if (result.status === "rejected") {
        logger.error(result.reason);
        return false;
      }

      return true;
    })
    .map((result) => result.value)
    .filter(([, coin]) => coin.amount !== "0")
    .map(([chain, coin]) => [chain, `${coin.amount}${coin.denom}`]);

  if (!balances.length) {
    console.log("No funds found for default denomination on any chain.");
    return;
  }

  console.log(borderlessTable([["CHAIN", "AMOUNT"], ...balances]));
}
