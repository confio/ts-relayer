import { Logger } from 'winston';

import { createLogger } from '../create-logger';
import { LoggerFlags } from '../types';

export function loggerWithErrorBoundary<T>(
  command: (flags: T, logger: Logger) => Promise<void>
) {
  return async (flags: T & LoggerFlags) => {
    const logger = createLogger(flags);

    try {
      await command(flags, logger);
    } catch (error) {
      logger.error(error);
    }
  };
}
