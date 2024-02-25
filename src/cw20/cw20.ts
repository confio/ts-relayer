import { toBase64, toUtf8 } from "@cosmjs/encoding";

import { CosmWasmSigner } from "..";

// creates it with 6 decimal places
// '123456789000'
export function init(
  owner: string,
  symbol: string,
  amount: string,
): Record<string, unknown> {
  return {
    decimals: 6,
    name: symbol,
    symbol,
    initial_balances: [
      {
        address: owner,
        amount,
      },
    ],
  };
}

export async function balance(
  cosmwasm: CosmWasmSigner,
  cw20Addr: string,
  senderAddress?: string,
): Promise<string> {
  const query = {
    balance: {
      address: senderAddress || cosmwasm.senderAddress,
    },
  };
  const res = await cosmwasm.sign.queryContractSmart(cw20Addr, query);
  // print this
  return res.balance;
}

export function sendTokens(
  targetAddr: string,
  amount: string,
  msg: Record<string, unknown>,
): Record<string, unknown> {
  const encoded = toBase64(toUtf8(JSON.stringify(msg)));
  const sendMsg = {
    send: {
      contract: targetAddr,
      amount,
      msg: encoded,
    },
  };
  return sendMsg;
}
