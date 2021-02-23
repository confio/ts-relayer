/* eslint-disable @typescript-eslint/no-explicit-any */

/* Logger interface with a subset of methods from winston.js */
export interface Logger {
  error: (message: string, ...meta: any[]) => Logger;
  warn: (message: string, ...meta: any[]) => Logger;
  info: (message: string, ...meta: any[]) => Logger;
  verbose: (message: string, ...meta: any[]) => Logger;
  debug: (message: string, ...meta: any[]) => Logger;
}

export class NoopLogger implements Logger {
  public readonly error: (message: string, ...meta: any[]) => Logger;
  public readonly warn: (message: string, ...meta: any[]) => Logger;
  public readonly info: (message: string, ...meta: any[]) => Logger;
  public readonly verbose: (message: string, ...meta: any[]) => Logger;
  public readonly debug: (message: string, ...meta: any[]) => Logger;

  constructor() {
    this.error = () => this;
    this.warn = () => this;
    this.info = () => this;
    this.verbose = () => this;
    this.debug = () => this;
  }
}
