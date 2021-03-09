import { getDefaultHomePath } from '../../get-default-home-path';
import { resolveRequiredOption } from '../resolve-required-option';

type Params = {
  homeFlag?: string;
};

export function resolveHomeOption({ homeFlag }: Params) {
  return resolveRequiredOption('home')(
    homeFlag,
    process.env.RELAYER_HOME,
    getDefaultHomePath
  );
}
