import { Logger } from '../../lib/logger';

// This is meant to be used around top-level command.
// If you have access to a logger, please use errorBoundary
export function rootBoundary<T>(
  command: (flags: T) => Promise<void>
): (flags: T) => Promise<void> {
  return async function (flags: T) {
    try {
      await command(flags);
    } catch (e) {
      // TODO: should we format this somehow?
      console.error(e);
      process.exit(1);
    }
  };
}

// FIXME: figure this one out better once we have loggers
export async function errorBoundary(
  logger: Logger,
  command: () => Promise<void>
) {
  try {
    await command();
  } catch (e) {
    // TODO: should we format this somehow?
    logger.error(e);
    process.exit(1);
  }
}
