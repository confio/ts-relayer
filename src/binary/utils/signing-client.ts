import { stringToPath } from '@cosmjs/crypto';
import { GasPrice } from '@cosmjs/launchpad';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

import { IbcClient, IbcClientOptions } from '../../lib/ibcclient';
import { Logger } from '../../lib/logger';
import { Chain } from '../types';

export async function signingClient(
  chain: Chain,
  mnemonic: string,
  logger?: Logger
): Promise<IbcClient> {
  const hdPath = chain.hd_path ? stringToPath(chain.hd_path) : undefined;
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(
    mnemonic,
    hdPath,
    chain.prefix
  );
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
