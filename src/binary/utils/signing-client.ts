import { stringToPath } from '@cosmjs/crypto';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { GasPrice } from '@cosmjs/stargate';

import { IbcClient, IbcClientOptions } from '../../lib/ibcclient';
import { Logger } from '../../lib/logger';
import { Chain } from '../types';

export async function signingClient(
  chain: Chain,
  mnemonic: string,
  logger?: Logger
): Promise<IbcClient> {
  const hdPathsToSpread = chain.hd_path
    ? { hdPaths: [stringToPath(chain.hd_path)] }
    : {};
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: chain.prefix,
    ...hdPathsToSpread,
  });
  const { address } = (await signer.getAccounts())[0];
  const options: IbcClientOptions = {
    prefix: chain.prefix,
    gasPrice: GasPrice.fromString(chain.gas_price),
    logger,
  };
  const client = await IbcClient.connectWithSigner(
    chain.rpc[0],
    signer,
    address,
    options
  );
  return client;
}
