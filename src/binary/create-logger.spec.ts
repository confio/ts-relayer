import test from "ava";

import { defaultLevel, resolveLevel } from "./create-logger";
import { LoggerFlags } from "./types";

function bootstrap(flags: Partial<LoggerFlags> = {}) {
  return resolveLevel({
    quiet: false,
    verbose: false,
    stackTrace: false,
    ...flags,
  });
}

function withEnv(logLevel: string, testFn: () => void) {
  process.env.RELAYER_LOG_LEVEL = logLevel;
  testFn();
  delete process.env.RELAYER_LOG_LEVEL;
}

test("resolves to default level for invalid log-level", (t) => {
  t.deepEqual(bootstrap({ logLevel: "invalid-log-level" }), [
    defaultLevel,
    "invalid-log-level",
  ]);

  t.deepEqual(bootstrap({ logLevel: "another-invalid-one", quiet: true }), [
    defaultLevel,
    "another-invalid-one",
  ]);

  t.deepEqual(bootstrap({ logLevel: "something-invalid", verbose: true }), [
    defaultLevel,
    "something-invalid",
  ]);

  t.deepEqual(
    bootstrap({ logLevel: "something-invalid", verbose: true, quiet: true }),
    [defaultLevel, "something-invalid"],
  );

  t.deepEqual(bootstrap({ logLevel: "", verbose: true, quiet: true }), [
    defaultLevel,
    "",
  ]);

  withEnv("random_env", () => {
    t.deepEqual(bootstrap({ verbose: true, quiet: true }), [
      defaultLevel,
      "random_env",
    ]);
  });

  withEnv("another_random", () => {
    t.deepEqual(bootstrap(), [defaultLevel, "another_random"]);
  });

  withEnv("", () => {
    t.deepEqual(bootstrap(), [defaultLevel, ""]);
  });
});

test("resolves to the most permissive level", (t) => {
  t.deepEqual(bootstrap({ logLevel: "info", quiet: true }), ["info", null]);

  t.deepEqual(bootstrap({ logLevel: "info", quiet: true, verbose: true }), [
    "verbose",
    null,
  ]);

  t.deepEqual(bootstrap({ logLevel: "info", verbose: true }), [
    "verbose",
    null,
  ]);

  t.deepEqual(bootstrap({ logLevel: "warn" }), ["warn", null]);

  t.deepEqual(bootstrap({ logLevel: "debug", verbose: true }), ["debug", null]);

  t.deepEqual(bootstrap({ logLevel: "error", verbose: true }), [
    "verbose",
    null,
  ]);

  withEnv("debug", () => {
    t.deepEqual(bootstrap({ quiet: true }), ["debug", null]);
  });

  withEnv("warn", () => {
    t.deepEqual(bootstrap({ quiet: true, verbose: true }), ["verbose", null]);
  });

  withEnv("warn", () => {
    t.deepEqual(bootstrap(), ["warn", null]);
  });

  withEnv("warn", () => {
    t.deepEqual(bootstrap({ logLevel: "error" }), ["error", null]);
  });

  withEnv("warn", () => {
    t.deepEqual(bootstrap({ logLevel: "error", verbose: true }), [
      "verbose",
      null,
    ]);
  });

  withEnv("verbose", () => {
    t.deepEqual(bootstrap({ quiet: true }), ["verbose", null]);
  });

  t.deepEqual(bootstrap({ verbose: true }), ["verbose", null]);

  t.deepEqual(bootstrap({ quiet: true }), ["error", null]);

  t.deepEqual(bootstrap({ quiet: true, verbose: true }), ["verbose", null]);
});
