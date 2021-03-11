import winston from 'winston';

import { LoggerFlags } from './types';
import { resolveOption } from './utils/options/resolve-option';

export const levels = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
};
type Level = keyof typeof levels;

export const defaultLevel = 'info'; // if not provided

function validateLevel(level: string | null): level is Level {
  return level ? Object.keys(levels).includes(level) : false;
}

export function resolveLevel(
  flags: LoggerFlags
): [level: Level, invalidInputLevel: string | null] {
  const level = resolveOption(flags.logLevel, process.env.RELAYER_LOG_LEVEL);

  if (level !== null && !validateLevel(level)) {
    return [defaultLevel, level];
  }

  const levelValue = levels[level ?? 'error'];

  if (flags.verbose && levelValue < levels.verbose) {
    return ['verbose', null];
  }

  if (flags.quiet && levelValue <= levels.error) {
    return ['error', null];
  }

  if (level) {
    return [level, null];
  }

  return [defaultLevel, null];
}

export function createLogger(flags: LoggerFlags) {
  const [level, invalidInputLevel] = resolveLevel(flags);

  const fileTransport = flags.logFile
    ? [
        new winston.transports.File({
          handleExceptions: true,
          filename: flags.logFile,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        }),
      ]
    : [];

  const logger = winston.createLogger({
    level,
    levels,
    transports: [
      new winston.transports.Console({
        handleExceptions: true,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
      ...fileTransport,
    ],
  });

  if (invalidInputLevel !== null) {
    logger.error(
      `Invalid log-level "${invalidInputLevel}". Please use one of: ${Object.keys(
        levels
      )
        .map((level) => `"${level}"`)
        .join(', ')}`
    );
  }

  return logger;
}
