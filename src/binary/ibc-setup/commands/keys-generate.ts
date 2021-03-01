import { resolveOption } from '../utils/resolve-option';

type Flags = {
  keyFile?: string;
};

type Options = {
  keyFile: string | null;
};

export function keysGenerate(flags: Flags) {
  const options = {
    keyFile: resolveOption(
      'key-file',
      flags.keyFile,
      process.env.RELAYER_KEY_FILE,
      null
    ),
  };

  run(options);
}

function run(options: Options) {
  console.log('keys generate run', options);
}
