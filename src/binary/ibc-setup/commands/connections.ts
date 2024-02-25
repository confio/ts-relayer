import path from "path";

import { State as ConnectionState } from "cosmjs-types/ibc/core/connection/v1/connection";
import { IdentifiedConnection } from "cosmjs-types/ibc/core/connection/v1/connection";

import { registryFile } from "../../constants";
import { Logger } from "../../create-logger";
import { borderlessTable } from "../../utils/borderless-table";
import { generateMnemonic } from "../../utils/generate-mnemonic";
import { loadAndValidateApp } from "../../utils/load-and-validate-app";
import { loadAndValidateRegistry } from "../../utils/load-and-validate-registry";
import { resolveOption } from "../../utils/options/resolve-option";
import { resolveHomeOption } from "../../utils/options/shared/resolve-home-option";
import { resolveKeyFileOption } from "../../utils/options/shared/resolve-key-file-option";
import { resolveMnemonicOption } from "../../utils/options/shared/resolve-mnemonic-option";
import { signingClient } from "../../utils/signing-client";

export type Flags = {
  readonly home?: string;
  readonly chain?: string;
  readonly mnemonic?: string;
  readonly keyFile?: string;
  readonly interactive: boolean;
};

export type Options = {
  readonly home: string;
  readonly chain: string;
  readonly mnemonic: string | null;
};

export async function connections(flags: Flags, logger: Logger) {
  const home = resolveHomeOption({ homeFlag: flags.home });
  const app = loadAndValidateApp(home);
  const keyFile = resolveKeyFileOption({ keyFileFlag: flags.keyFile, app });
  const chain = resolveOption("chain", { required: true })(
    flags.chain,
    process.env.RELAYER_CHAIN,
  );

  const mnemonic = await resolveMnemonicOption(
    {
      interactiveFlag: flags.interactive,
      mnemonicFlag: flags.mnemonic,
      keyFile,
      app,
    },
    true, // mnemonic is optional
  );

  const options: Options = {
    home,
    chain,
    mnemonic,
  };

  await run(options, logger);
}

function connectionStateAsText(state: ConnectionState) {
  switch (state) {
    case ConnectionState.STATE_INIT:
      return "Init";

    case ConnectionState.STATE_OPEN:
      return "Open";

    case ConnectionState.STATE_TRYOPEN:
      return "Tryopen";

    case ConnectionState.STATE_UNINITIALIZED_UNSPECIFIED:
      return "UninitializedUnspecified";

    case ConnectionState.UNRECOGNIZED:
    default:
      return "Unrecognized";
  }
}

export async function run(options: Options, logger: Logger) {
  const registryFilePath = path.join(options.home, registryFile);
  const registry = loadAndValidateRegistry(registryFilePath);

  const chain = registry.chains[options.chain];
  if (!chain) {
    throw new Error(`Chain ${options.chain} not found in ${registryFilePath}.`);
  }

  const mnemonic = options.mnemonic ?? generateMnemonic();

  const client = await signingClient(chain, mnemonic, logger);

  const { connections: allConnections } =
    await client.query.ibc.connection.allConnections();

  const connections = allConnections.map((connection: IdentifiedConnection) => [
    connection.id,
    connection.clientId,
    connection.delayPeriod.toString(10),
    connectionStateAsText(connection.state),
  ]);

  if (!connections.length) {
    console.log(`No connections found for chain "${options.chain}".`);

    return;
  }

  const output = borderlessTable([
    ["CONNECTION_ID", "CLIENT_ID", "DELAY", "STATE"],
    ...connections,
  ]);

  console.log(output);
}
