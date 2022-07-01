import { readFileSync } from 'fs';

import { testutils } from '..';
const { setupWasmClient } = testutils;

export async function setupContracts(
  contracts: Record<string, string>
): Promise<Record<string, number>> {
  const cosmwasm = await setupWasmClient();

  const results: Record<string, number> = {};

  for (const name in contracts) {
    const path = `./src/testdata/${contracts[name]}`;
    console.info(`Storing ${name} from ${path}...`);
    const wasm = await readFileSync(path);
    const receipt = await cosmwasm.sign.upload(
      cosmwasm.senderAddress,
      wasm,
      'auto',
      `Upload ${name}`
    );
    console.debug(`Upload ${name} with CodeID: ${receipt.codeId}`);
    results[name] = receipt.codeId;
  }

  return results;
}
