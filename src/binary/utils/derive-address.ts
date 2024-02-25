import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

export async function deriveAddress(
  mnemomic: string,
  prefix: string,
  hdPath?: string,
): Promise<string> {
  const hdPathsToSpread = hdPath ? { hdPaths: [stringToPath(hdPath)] } : {};
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemomic, {
    prefix,
    ...hdPathsToSpread,
  });
  const accounts = await wallet.getAccounts();
  return accounts[0].address;
}
