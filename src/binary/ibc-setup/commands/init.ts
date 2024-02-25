import fs from "fs";
import path from "path";

import { FaucetClient } from "@cosmjs/faucet-client";
import axios from "axios";
import yaml from "js-yaml";

import { appFile, registryFile } from "../../constants";
import { Logger } from "../../create-logger";
import { feeDenom } from "../../types";
import { deriveAddress } from "../../utils/derive-address";
import { generateMnemonic } from "../../utils/generate-mnemonic";
import { isNoExistError } from "../../utils/is-no-exist-error";
import { loadAndValidateRegistry } from "../../utils/load-and-validate-registry";
import { resolveOption } from "../../utils/options/resolve-option";
import { resolveHomeOption } from "../../utils/options/shared/resolve-home-option";

type Flags = {
  readonly home?: string;
  readonly src?: string;
  readonly dest?: string;
  readonly registryFrom?: string;
};

export type Options = {
  readonly home: string;
  readonly src: string | null;
  readonly dest: string | null;
  readonly registryFrom: string | null;
};

function copyRegistryFile(from: string, to: string) {
  try {
    fs.copyFileSync(from, to);
    console.log(`Copied existing registry from ${from} to ${to}.`);
  } catch (error) {
    if (isNoExistError(error)) {
      throw new Error(
        `No such file: ${from}. Make sure that "--registry-from" points at existing relayer's home dir.`,
      );
    } else {
      throw error;
    }
  }
}

async function pullRegistryFromRemote(writeTo: string) {
  try {
    const registryFromRemote = await axios.get(
      "https://raw.githubusercontent.com/confio/ts-relayer/main/demo/registry.yaml",
    );
    fs.writeFileSync(writeTo, registryFromRemote.data);
    console.log(`Pulled default ${registryFile} from remote.`);
  } catch (error) {
    throw new Error(`Cannot fetch ${registryFile} from remote. ${error}`);
  }
}

export async function init(flags: Flags, _logger: Logger) {
  const options = {
    src: resolveOption("src")(flags.src, process.env.RELAYER_SRC),
    dest: resolveOption("dest")(flags.dest, process.env.RELAYER_DEST),
    home: resolveHomeOption({ homeFlag: flags.home }),
    registryFrom: resolveOption("registryFrom")(
      flags.registryFrom,
      process.env.RELAYER_REGISTRY_FROM,
    ),
  };

  await run(options);
}

export async function run(options: Options) {
  const appFilePath = path.join(options.home, appFile);
  if (fs.existsSync(appFilePath)) {
    console.log(`The ${appFile} is already initialized at ${options.home}.`);
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
    if (options.registryFrom) {
      copyRegistryFile(
        path.join(options.registryFrom, registryFile),
        registryFilePath,
      );
    } else {
      await pullRegistryFromRemote(registryFilePath);
    }
  } else if (!fs.lstatSync(registryFilePath).isFile()) {
    throw new Error(`${registryFilePath} must be a file.`);
  }

  if (!options.src || !options.dest) {
    console.log(
      `Exited early. Registry file downloaded to ${registryFilePath}. Please edit that file and add any chains you wish. Then complete the initialization by running ibc-setup init --src <chain-1> --dest <chain-2>.`,
    );
    return;
  }

  const registry = loadAndValidateRegistry(registryFilePath);

  const [chainSrc, chainDest] = [options.src, options.dest].map((chain) => {
    const chainData = registry.chains[chain];

    if (!chainData) {
      throw new Error(
        `Chain ${chain} is missing in the registry, either check the spelling or add the chain definition to ${registryFilePath}.`,
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
    },
  );

  fs.writeFileSync(appFilePath, appYaml, { encoding: "utf-8" });
  console.log(`Saved configuration to ${appFilePath}`);

  const [addressSrc, addressDest] = await Promise.all([
    deriveAddress(mnemonic, chainSrc.prefix, chainSrc.hd_path),
    deriveAddress(mnemonic, chainDest.prefix, chainDest.hd_path),
  ]);
  console.log(`Source address: ${addressSrc}`);
  console.log(`Destination address: ${addressDest}`);

  // if there are faucets, ask for tokens
  if (chainSrc.faucet) {
    const srcDenom = feeDenom(chainSrc);
    console.log(`Requesting ${srcDenom} for ${chainSrc.chain_id}...`);
    await new FaucetClient(chainSrc.faucet).credit(addressSrc, srcDenom);
  }
  if (chainDest.faucet) {
    const destDenom = feeDenom(chainDest);
    console.log(`Requesting ${destDenom} for ${chainDest.chain_id}...`);
    await new FaucetClient(chainDest.faucet).credit(addressDest, destDenom);
  }
}
