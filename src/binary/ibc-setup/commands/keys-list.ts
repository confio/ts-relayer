// import { resolveOption } from '../utils/resolve-option';

// import { resolveOption } from '../utils/resolve-option';

export type Options = {
  readonly home: string;
  readonly keyFile?: string;
  readonly mnemonic?: string;
  readonly interactive?: boolean;
};

export function keysList(flags: Options) {
  console.log(flags);
  //   const options: Options = {};

  //   run(options);
}

export function run(options: Options) {
  console.log(options);
}
