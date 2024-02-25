import path from "path";

import { State as ChannelState } from "cosmjs-types/ibc/core/channel/v1/channel";

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
  readonly port?: string;
  readonly connection?: string;
  readonly chain?: string;
  readonly mnemonic?: string;
  readonly keyFile?: string;
  readonly interactive: boolean;
};

export type Options = {
  readonly home: string;
  readonly chain: string;
  readonly mnemonic: string | null;
  readonly port: string | null;
  readonly connection: string | null;
};

export async function channels(flags: Flags, logger: Logger) {
  const home = resolveHomeOption({ homeFlag: flags.home });
  const app = loadAndValidateApp(home);
  const keyFile = resolveKeyFileOption({ keyFileFlag: flags.keyFile, app });
  const chain = resolveOption("chain", { required: true })(
    flags.chain,
    process.env.RELAYER_CHAIN,
  );
  const port = resolveOption("port")(flags.port, process.env.RELAYER_PORT);
  const connection = resolveOption("connection")(
    flags.connection,
    process.env.RELAYER_CONNECTION,
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
    port,
    connection,
  };

  await run(options, logger);
}

export function channelStateAsText(state: ChannelState) {
  switch (state) {
    case ChannelState.STATE_CLOSED:
      return "Closed";

    case ChannelState.STATE_INIT:
      return "Init";

    case ChannelState.STATE_OPEN:
      return "Open";

    case ChannelState.STATE_TRYOPEN:
      return "Tryopen";

    case ChannelState.STATE_UNINITIALIZED_UNSPECIFIED:
      return "UninitializedUnspecified";

    case ChannelState.UNRECOGNIZED:
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

  const { channels: allChannels } =
    await client.query.ibc.channel.allChannels();

  const channels = allChannels
    .filter(
      (channel) => (options.port ? channel.portId === options.port : true), // don't filter if port is not specified
    )
    .filter(
      (channel) =>
        options.connection
          ? channel.connectionHops.includes(options.connection)
          : true, // don't filter if connection is not specified
    )
    .map((channel) => [
      channel.channelId,
      channel.portId,
      channel.connectionHops.join(", "),
      channelStateAsText(channel.state),
    ]);

  if (!channels.length) {
    const conditionalPortInfo = options.port
      ? ` on port "${options.port}"`
      : "";
    const conditionalConnectionInfo = options.connection
      ? ` with connection "${options.connection}"`
      : "";

    console.log(
      `No channels found for chain "${options.chain}"${conditionalPortInfo}${conditionalConnectionInfo}.`,
    );

    return;
  }

  const output = borderlessTable([
    ["CHANNEL_ID", "PORT", "CONNECTION(S)", "STATE"],
    ...channels,
  ]);

  console.log(output);
}
