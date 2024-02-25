import { getDefaultHomePath } from "../../get-default-home-path";
import { resolveOption } from "../resolve-option";

type Params = {
  homeFlag?: string;
};

export function resolveHomeOption({ homeFlag }: Params) {
  return resolveOption("home", { required: true })(
    homeFlag,
    process.env.RELAYER_HOME,
    getDefaultHomePath,
  );
}
