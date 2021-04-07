import { GasPrice } from '@cosmjs/stargate';

export type Chain = {
  chain_id: string;
  prefix: string;
  gas_price: string;
  faucet?: string;
  hd_path?: string;
  ics20_port?: string;
  rpc: string[];
};

export type Registry = {
  version: number;
  chains: Record<string, Chain>;
};

export type AppConfig = {
  src?: string;
  srcConnection?: string;
  dest?: string;
  destConnection?: string;
  mnemonic?: string;
  keyFile?: string;
};

export type LoggerFlags = {
  logLevel?: string;
  logFile?: string;
  verbose: boolean;
  quiet: boolean;
};

export function feeDenom(chain: Chain): string {
  return GasPrice.fromString(chain.gas_price).denom;
}
