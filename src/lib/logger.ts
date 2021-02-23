/* eslint-disable @typescript-eslint/no-explicit-any */

// From https://github.com/winstonjs/winston/blob/v3.3.3/index.d.ts#L53
type LogCallback = (
  error?: any,
  level?: string,
  message?: string,
  meta?: any
) => void;

// From https://github.com/winstonjs/winston/blob/v3.3.3/index.d.ts#L69-L75
export interface LeveledLogMethod {
  (message: string, callback: LogCallback): Logger;
  (message: string, meta: any, callback: LogCallback): Logger;
  (message: string, ...meta: any[]): Logger;
  (message: any): Logger;
  (infoObject: Record<string, unknown>): Logger;
}

// Logger interface with a subset of methods from https://github.com/winstonjs/winston/blob/v3.3.3/index.d.ts#L107-L115
export interface Logger {
  error: LeveledLogMethod;
  warn: LeveledLogMethod;
  info: LeveledLogMethod;
  verbose: LeveledLogMethod;
  debug: LeveledLogMethod;
}

export class NoopLogger implements Logger {
  public readonly error: LeveledLogMethod;
  public readonly warn: LeveledLogMethod;
  public readonly info: LeveledLogMethod;
  public readonly verbose: LeveledLogMethod;
  public readonly debug: LeveledLogMethod;

  constructor() {
    this.error = () => this;
    this.warn = () => this;
    this.info = () => this;
    this.verbose = () => this;
    this.debug = () => this;
  }
}
