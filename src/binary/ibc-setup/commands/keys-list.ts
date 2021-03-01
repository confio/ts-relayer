import { getDefaultHomePath } from '../utils/get-default-home-path';
import { resolveOption } from '../utils/resolve-option';

export type Options = {
  readonly home?: string;
  readonly keyFile?: string;
  readonly mnemonic?: string;
  readonly interactive?: boolean;
};

export function keysList(flags: Options) {
  console.log(flags);
  const options = {
    home: resolveOption(
      flags.home,
      process.env.RELAYER_HOME,
      getDefaultHomePath
    ),
  };

  run(options);
}

export function run(options: Options) {
  console.log(options);
}
