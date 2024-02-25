import { createLogger, Logger } from "../create-logger";
import { LoggerFlags } from "../types";

export function loggerWithErrorBoundary<T>(
  command: (flags: T, logger: Logger) => Promise<void>,
) {
  return async (flags: T & LoggerFlags) => {
    const logger = createLogger(flags);

    try {
      await command(flags, logger);
    } catch (error) {
      /*
       * TODO: polish error handling
       *
       * if (error instanceOf InvalidOptionError) {
       *  // do something else?
       * }
       */

      logger.error(error);
    }
  };
}
