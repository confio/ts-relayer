#!/usr/bin/env node

import { Command } from "commander";

import {
  addLoggerOptionsTo,
  chainOption,
  destConnection,
  destOption,
  destPort,
  destTrust,
  helpOptions,
  homeOption,
  interactiveOption,
  keyFileOption,
  mnemonicOption,
  srcConnection,
  srcOption,
  srcPort,
  srcTrust,
} from "../commander-options";
import { loggerWithErrorBoundary } from "../utils/logger-with-error-boundary";

import { balances } from "./commands/balances";
import { channel, defaults as channelDefaults } from "./commands/channel";
import { channels } from "./commands/channels";
import { connect } from "./commands/connect";
import { connections } from "./commands/connections";
import { ics20, defaults as ics20Defaults } from "./commands/ics20";
import { init } from "./commands/init";
import { keysGenerate } from "./commands/keys-generate";
import { keysList } from "./commands/keys-list";

export const program = new Command();

program.helpOption(...helpOptions);
program.addHelpCommand(false);

program.description("Collection of commands to quickly setup a relayer");

const initCommand = program
  .command("init")
  .description(
    "Initialize relayer's home directory with registry.yaml and app.yaml configuration files",
  )
  .addOption(homeOption)
  .addOption(srcOption)
  .addOption(destOption)
  .option(
    "--registry-from <path>",
    "Copy existing relayer registry from given home directory",
  )
  .action(loggerWithErrorBoundary(init));
addLoggerOptionsTo(initCommand);

const ics20Command = program
  .command("ics20")
  .description(
    "Create new unordered channel (ics20-1) for given chains, ports, and connections",
  )
  .addOption(homeOption)
  .addOption(srcTrust)
  .addOption(destTrust)
  .addOption(mnemonicOption)
  .addOption(srcPort(` (default: ${ics20Defaults.port})`))
  .addOption(destPort(` (default: ${ics20Defaults.port})`))
  .action(loggerWithErrorBoundary(ics20));
addLoggerOptionsTo(ics20Command);

const keys = program.command("keys").description("Manage application keys");

const keysGenerateCommand = keys
  .command("generate")
  .description("Generate 12 words length mnemonic")
  .addOption(keyFileOption("write"))
  .action(loggerWithErrorBoundary(keysGenerate));
addLoggerOptionsTo(keysGenerateCommand);

const keysListCommand = keys
  .command("list")
  .description("Print addresses for registry chains")
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(keyFileOption("read"))
  .addOption(interactiveOption)
  .action(loggerWithErrorBoundary(keysList));
addLoggerOptionsTo(keysListCommand);

const balancesCommand = program
  .command("balances")
  .description("Query balances for registry chains with non-zero amount")
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(keyFileOption("read"))
  .addOption(interactiveOption)
  .action(loggerWithErrorBoundary(balances));
addLoggerOptionsTo(balancesCommand);

const connectCommand = program
  .command("connect")
  .description("Create and store new connections for given chains")
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(keyFileOption("read"))
  .addOption(interactiveOption)
  .addOption(srcTrust)
  .addOption(destTrust)
  .action(loggerWithErrorBoundary(connect));
addLoggerOptionsTo(connectCommand);

const channelsCommand = program
  .command("channels")
  .description("Query channels on given chain and optionally filter by port")
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(interactiveOption)
  .addOption(chainOption)
  .option("--connection <connection-id>", "Filter channels by connection id")
  .option("--port <port>", "Filter channels by port")
  .action(loggerWithErrorBoundary(channels));
addLoggerOptionsTo(channelsCommand);

const channelCommand = program
  .command("channel")
  .description("Create new channel for given options")
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(interactiveOption)
  .addOption(keyFileOption("read"))
  .addOption(srcConnection)
  .addOption(destConnection)
  .addOption(srcPort())
  .addOption(destPort())
  .option("--ordered")
  .option("--version <version>", `(default: ${channelDefaults.version})`)
  .action(loggerWithErrorBoundary(channel));
addLoggerOptionsTo(channelCommand);

const connectionsCommand = program
  .command("connections")
  .description("Query connections for given chain")
  .addOption(homeOption)
  .addOption(mnemonicOption)
  .addOption(interactiveOption)
  .addOption(chainOption)
  .action(loggerWithErrorBoundary(connections));
addLoggerOptionsTo(connectionsCommand);

// We don't have top-level await in commonjs
program.parseAsync(process.argv).then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(5);
  },
);
