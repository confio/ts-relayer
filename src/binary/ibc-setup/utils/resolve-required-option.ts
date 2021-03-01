import { resolveOption } from './resolve-option';

export function resolveRequiredOption(
  identifier: string,
  ...args: Parameters<typeof resolveOption>
) {
  const option = resolveOption(...args);

  if (!option) {
    throw new Error(`Cannot resolve "${identifier}" option.`);
  }

  return option;
}
