import { InvalidOptionError } from "../../exceptions/InvalidOptionError";

type Args<T = string> = Array<(T | undefined | null) | (() => T | null)>;

// if required and integer then it's a number
export function resolveOption(
  identifier: string,
  options: { required: true; integer: true },
): (...args: Args<string | number>) => number;

// if not required and integer then it's a number or null
export function resolveOption(
  identifier: string,
  options: { required?: false; integer: true },
): (...args: Args<string | number>) => number | null;

// if not required and not integer then it's a string or null
export function resolveOption(
  identifier: string,
  options?: { required?: false; integer?: false },
): (...args: Args) => string | null;

// if required and not integer then it's a string
export function resolveOption(
  identifier: string,
  options: { required: true; integer?: false },
): (...args: Args) => string;

export function resolveOption(
  identifier: string,
  optionsParam?: { required?: boolean; integer?: boolean },
) {
  return (...args: Args) => {
    const options = {
      required: optionsParam?.required ?? false,
      integer: optionsParam?.integer ?? false,
    };

    const value = findValue(...args);

    if (value === null) {
      if (options.required) {
        throw new InvalidOptionError(`"${identifier}" option is required.`);
      }
      return null;
    }

    if (options.integer) {
      const parsedValue = parseInt(value, 10);

      if (isNaN(parsedValue)) {
        throw new InvalidOptionError(
          `"${identifier}" option has value "${value}" while it must be an integer.`,
        );
      }

      return parsedValue;
    }

    return value;
  };
}

function findValue(...args: Args) {
  for (const option of args) {
    const value = typeof option === "function" ? option() : option;

    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
}
