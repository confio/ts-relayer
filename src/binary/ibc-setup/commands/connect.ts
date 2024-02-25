import fs from "fs";
import path from "path";

import yaml from "js-yaml";

import { Link } from "../../../lib/link";
import { appFile, registryFile } from "../../constants";
import { Logger } from "../../create-logger";
import { AppConfig } from "../../types";
import { loadAndValidateApp } from "../../utils/load-and-validate-app";
import { loadAndValidateRegistry } from "../../utils/load-and-validate-registry";
import { resolveOption } from "../../utils/options/resolve-option";
import { resolveHomeOption } from "../../utils/options/shared/resolve-home-option";
import { resolveKeyFileOption } from "../../utils/options/shared/resolve-key-file-option";
import { resolveMnemonicOption } from "../../utils/options/shared/resolve-mnemonic-option";
import { signingClient } from "../../utils/signing-client";

export type Flags = {
  readonly interactive: boolean;
  readonly home?: string;
  readonly keyFile?: string;
  readonly mnemonic?: string;
  readonly srcTrust?: string;
  readonly destTrust?: string;
};

export type Options = {
  readonly home: string;
  readonly mnemonic: string;
  readonly src: string;
  readonly dest: string;
  readonly srcTrust: number | null;
  readonly destTrust: number | null;
};

export async function connect(flags: Flags, logger: Logger) {
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
  const src = resolveOption("src", { required: true })(app.src);
  const dest = resolveOption("dest", { required: true })(app.dest);
  const srcTrust = resolveOption("srcTrust", { integer: true })(
    flags.srcTrust,
    process.env.RELAYER_SRC_TRUST,
  );
  const destTrust = resolveOption("destTrust", { integer: true })(
    flags.destTrust,
    process.env.RELAYER_DEST_TRUST,
  );

  const options: Options = {
    home,
    mnemonic,
    src,
    dest,
    srcTrust,
    destTrust,
  };

  await run(options, app, logger);
}

export async function run(options: Options, app: AppConfig, logger: Logger) {
  const registryFilePath = path.join(options.home, registryFile);
  const registry = loadAndValidateRegistry(registryFilePath);
  const srcChain = registry.chains[options.src];
  if (!srcChain) {
    throw new Error(`src channel  "${options.src}" not found in registry`);
  }
  const destChain = registry.chains[options.dest];
  if (!destChain) {
    throw new Error(`dest channel  "${options.dest}" not found in registry`);
  }

  const nodeA = await signingClient(srcChain, options.mnemonic, logger);
  const nodeB = await signingClient(destChain, options.mnemonic, logger);
  const link = await Link.createWithNewConnections(
    nodeA,
    nodeB,
    logger,
    options.srcTrust,
    options.destTrust,
  );

  const appYaml = yaml.dump(
    {
      ...app,
      srcConnection: link.endA.connectionID,
      destConnection: link.endB.connectionID,
    },
    {
      lineWidth: 1000,
    },
  );

  fs.writeFileSync(path.join(options.home, appFile), appYaml, {
    encoding: "utf-8",
  });

  console.log(
    `Created connections ${link.endA.connectionID} (${link.endA.clientID}) <=> ${link.endB.connectionID} (${link.endB.clientID})`,
  );
}
