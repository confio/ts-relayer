import winston from 'winston';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
};

export type Level = keyof typeof levels;

export function createLogger(level: Level) {
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
    ],
  });

  return logger;
}
