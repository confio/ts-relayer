import { resolveOption } from '../utils/resolve-option';

type Options = {
  keyFile?: string;
};

export function keysGenerate(flags: Options) {
  const options = {
    keyFile: resolveOption(
      'key-file',
      flags.keyFile,
      process.env.RELAYER_KEY_FILE
    ),
  };

  run(options);
}

function run(options: Options) {
  console.log('keys generate run', options);
}
