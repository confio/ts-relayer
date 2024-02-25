import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";

import { IbcClient, IbcClientOptions } from "../../lib/ibcclient";
import { Logger } from "../../lib/logger";
import { Chain } from "../types";

export async function signingClient(
  chain: Chain,
  mnemonic: string,
  logger?: Logger,
): Promise<IbcClient> {
  const hdPathsToSpread = chain.hd_path
    ? { hdPaths: [stringToPath(chain.hd_path)] }
    : {};
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: chain.prefix,
    ...hdPathsToSpread,
  });
  const { address } = (await signer.getAccounts())[0];
  // This is test timing to let us handle 250ms blocks without huge delays
  const extras =
    process.env.NODE_ENV == "test"
      ? {
          broadcastPollIntervalMs: 300,
          broadcastTimeoutMs: 2000,
        }
      : {};
  const options: IbcClientOptions = {
    gasPrice: GasPrice.fromString(chain.gas_price),
    estimatedBlockTime: chain.estimated_block_time,
    estimatedIndexerTime: chain.estimated_indexer_time,
    logger,
    ...extras,
  };
  const client = await IbcClient.connectWithSigner(
    chain.rpc[0],
    signer,
    address,
    options,
  );
  return client;
}
