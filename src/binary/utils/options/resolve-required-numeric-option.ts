import { resolveNumericOption } from './resolve-numeric-option';

export function resolveRequiredNumericOption(identifier: string) {
  return (...args: Parameters<typeof resolveNumericOption>) => {
    const option = resolveNumericOption(...args);

    if (!option) {
      throw new Error(`Cannot resolve "${identifier}" option.`);
    }

    return option;
  };
}
