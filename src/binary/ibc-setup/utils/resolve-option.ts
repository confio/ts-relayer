export function resolveOption(
  ...args: Array<(string | undefined | null) | (() => string | null)>
) {
  for (const option of args) {
    const value = typeof option === 'function' ? option() : option;

    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
}
