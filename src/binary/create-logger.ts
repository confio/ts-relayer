import jsonStringify from "fast-safe-stringify";
import { MESSAGE } from "triple-beam";
import winston from "winston";

import { LoggerFlags } from "./types";
import { resolveOption } from "./utils/options/resolve-option";

// Re-export Logger interface with type-safe child method.
export interface Logger extends Omit<winston.Logger, "child"> {
  child(options: { label: string }): Logger;
}

export const levels = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
};
type Level = keyof typeof levels;

export const defaultLevel = "info"; // if not provided

function validateLevel(level: string | null): level is Level {
  return level ? Object.keys(levels).includes(level) : false;
}

export function resolveLevel(
  flags: LoggerFlags,
): [level: Level, invalidInputLevel: string | null] {
  const level = resolveOption("logLevel")(
    flags.logLevel,
    process.env.RELAYER_LOG_LEVEL,
  );

  if (level !== null && !validateLevel(level)) {
    return [defaultLevel, level];
  }

  const levelValue = levels[level ?? "error"];

  if (flags.verbose && levelValue < levels.verbose) {
    return ["verbose", null];
  }

  if (flags.quiet && levelValue <= levels.error) {
    return ["error", null];
  }

  if (level) {
    return [level, null];
  }

  return [defaultLevel, null];
}

export function createLogger(flags: LoggerFlags): Logger {
  const [level, invalidInputLevel] = resolveLevel(flags);

  const fileTransport = flags.logFile
    ? [
        new winston.transports.File({
          handleExceptions: true,
          filename: flags.logFile,
          format: winston.format.combine(winston.format.timestamp()),
        }),
      ]
    : [];

  const logger = winston.createLogger({
    level,
    levels,
    format: winston.format.combine(
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    transports: [
      new winston.transports.Console({
        handleExceptions: true,
        format: winston.format.combine(
          winston.format.colorize(),
          simpleFormat(flags.stackTrace),
        ),
      }),

      ...fileTransport,
    ],
  });

  if (invalidInputLevel !== null) {
    logger.error(
      `Invalid log-level "${invalidInputLevel}". Please use one of: ${Object.keys(
        levels,
      )
        .map((level) => `"${level}"`)
        .join(", ")}`,
    );
  }

  return logger;
}

// Heavily based on https://github.com/winstonjs/logform/blob/master/simple.js
function simpleFormat(stackTrace: boolean) {
  return winston.format((info: winston.Logform.TransformableInfo) => {
    let stringifiedRest = jsonStringify({
      ...info,
      level: undefined,
      message: undefined,
      label: undefined,

      ...(stackTrace ? {} : { stack: undefined }), // remove `stack` from the output if no --stack-trace is provided
    });
    stringifiedRest = stringifiedRest !== "{}" ? ` ${stringifiedRest}` : "";

    const label = info.label ? ` [${info.label}]` : "";

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: indexing with symbols: https://github.com/microsoft/TypeScript/issues/1863
    info[MESSAGE] = `${info.level}:${label} ${info.message}${stringifiedRest}`;

    return info;
  })();
}
