export function resolveOption(
  ...args: Array<(string | undefined) | (() => string | undefined)>
) {
  for (const option of args) {
    const value = typeof option === 'function' ? option() : option;

    if (typeof value !== 'undefined') {
      return value;
    }
  }

  return undefined;
}
