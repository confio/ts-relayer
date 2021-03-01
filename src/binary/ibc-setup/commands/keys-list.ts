// import { resolveOption } from '../utils/resolve-option';

// import { resolveOption } from '../utils/resolve-option';

export type Options = {
  keyFile?: string;
  mnemonic?: string;
  interactive?: boolean;
  home?: string;
};

export function keysList(flags: Options) {
  console.log(flags);
  const options: Options = {};

  //   run(options);
}

export function run(options: Options) {
  console.log(options);
}
