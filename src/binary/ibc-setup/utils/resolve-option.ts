export function resolveOption(
  identifier: string,
  ...args: Array<(string | undefined) | (() => string | undefined | void)>
) {
  for (const option of args) {
    const value = typeof option === 'function' ? option() : option;

    if (typeof value !== 'undefined') {
      return value;
    }
  }

  throw new Error(`Couldn't resolve ${identifier} option.`);
}
