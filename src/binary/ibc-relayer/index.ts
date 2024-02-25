#!/usr/bin/env node

import { Command } from "commander";

import {
  addLoggerOptionsTo,
  destConnection,
  destOption,
  helpOptions,
  homeOption,
  interactiveOption,
  keyFileOption,
  mnemonicOption,
  srcConnection,
  srcOption,
} from "../commander-options";
import { loggerWithErrorBoundary } from "../utils/logger-with-error-boundary";

import { start, defaults as startDefaults } from "./commands/start";

const program = new Command();

program.helpOption(...helpOptions);
program.addHelpCommand(false);

program.description("Typescript implementation of an IBC relayer");

const startCommand = program
  .command("start")
  .description(
    "Relay all packets over all channels on pre-configured connection",
  )
  .addOption(homeOption)
  .addOption(srcOption)
  .addOption(destOption)
  .addOption(interactiveOption)
  .addOption(keyFileOption("read"))
  .addOption(mnemonicOption)
  .addOption(srcConnection)
  .addOption(destConnection)
  .option(
    "--enable-metrics",
    "Enable Prometheus metrics collection and GET /metrics endpoint",
  )
  .option(
    `--metrics-port <port>', 'Specify port for GET /metrics http server (default: ${startDefaults.metricsPort})`,
  )
  .option(
    "--poll <frequency>",
    `How many seconds we sleep between checking for packets (default: ${startDefaults.poll})`,
  )
  .option(
    "--max-age-src <seconds>",
    `How old can the client on src chain be, before we update it (default: ${startDefaults.maxAgeSrc})`,
  )
  .option(
    "--max-age-dest <seconds>",
    `How old can the client on dest chain be, before we update it (default: ${startDefaults.maxAgeDest})`,
  )
  .option("--scan-from-src <height>")
  .option("--scan-from-dest <height>")
  // note: once is designed for debugging and unit tests
  .option("--once", "Relay pending packets and quit, no polling")
  .action(loggerWithErrorBoundary(start));

addLoggerOptionsTo(startCommand);

// We don't have top-level await in commonjs
program.parseAsync(process.argv).then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(5);
  },
);
