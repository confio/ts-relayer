// Adapted from https://github.com/winstonjs/winston/blob/v3.3.3/index.d.ts#L69-L75
export type LogMethod = (
  /* The string to be logged */
  message: string,
  /* Optional object to be JSON-stringified by the logger */
  meta?: Record<string, unknown>,
) => Logger;

// Logger interface with a subset of methods from https://github.com/winstonjs/winston/blob/v3.3.3/index.d.ts#L107-L115
export interface Logger {
  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  verbose: LogMethod;
  debug: LogMethod;
}

export class NoopLogger implements Logger {
  public readonly error: LogMethod;
  public readonly warn: LogMethod;
  public readonly info: LogMethod;
  public readonly verbose: LogMethod;
  public readonly debug: LogMethod;

  constructor() {
    this.error = () => this;
    this.warn = () => this;
    this.info = () => this;
    this.verbose = () => this;
    this.debug = () => this;
  }
}
