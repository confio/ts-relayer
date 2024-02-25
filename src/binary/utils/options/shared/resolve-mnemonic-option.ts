import fs from "fs";
import readline from "readline";

import { AppConfig } from "../../../types";
import { resolveOption } from "../resolve-option";

async function readMnemonicFromStdin(interactive: boolean) {
  if (!interactive) {
    return null;
  }

  const readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const mnemonic = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout for entering mnemonic exceeded."));
    }, 60 * 1000);

    readlineInterface.question("enter mnemonic phrase: ", (stdin) => {
      readlineInterface.close();
      clearTimeout(timeout);
      resolve(stdin);
    });
  });

  return mnemonic;
}

function readMnemonicFromFile(keyFile: string | null) {
  if (!keyFile) {
    return null;
  }

  return () => {
    return fs.readFileSync(keyFile, "utf-8").trim();
  };
}

type Params = {
  interactiveFlag: boolean;
  mnemonicFlag?: string;
  keyFile: string | null;
  app: AppConfig | null;
};

export async function resolveMnemonicOption(
  params: Params,
  optional: true,
): Promise<string | null>;

export async function resolveMnemonicOption(
  params: Params,
  optional?: false,
): Promise<string>;

export async function resolveMnemonicOption(
  { interactiveFlag, keyFile, mnemonicFlag, app }: Params,
  optional = false,
) {
  const args = [
    await readMnemonicFromStdin(interactiveFlag),
    mnemonicFlag,
    process.env.RELAYER_MNEMONIC,
    app?.mnemonic,
    readMnemonicFromFile(keyFile),
  ];

  if (!optional) {
    return resolveOption("mnemonic", { required: true })(...args);
  }

  return resolveOption("mnemonic")(...args);
}
