import { stringToPath } from '@cosmjs/crypto';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

export async function deriveAddress(
  mnemomic: string,
  prefix: string,
  path: string
): Promise<string> {
  const hdpath = stringToPath(path);
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
    mnemomic,
    hdpath,
    prefix
  );
  const accounts = await wallet.getAccounts();
  return accounts[0].address;
}
