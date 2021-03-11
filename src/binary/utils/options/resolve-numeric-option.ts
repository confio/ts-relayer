export function resolveNumericOption(
  ...args: Array<(number | undefined | null) | (() => number | null)>
) {
  for (const option of args) {
    const value = typeof option === 'function' ? option() : option;

    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
}
