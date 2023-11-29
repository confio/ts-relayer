import { GasPrice } from "@cosmjs/stargate";

export type Chain = {
  chain_id: string;
  prefix: string;
  gas_price: string;
  faucet?: string;
  hd_path?: string;
  ics20_port?: string;
  rpc: string[];
  estimated_block_time: number;
  estimated_indexer_time: number;
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
  enableMetrics?: boolean;
  metricsPort?: number;
};

export type LoggerFlags = {
  logLevel?: string;
  logFile?: string;
  verbose: boolean;
  quiet: boolean;
  stackTrace: boolean;
};

export function feeDenom(chain: Chain): string {
  return GasPrice.fromString(chain.gas_price).denom;
}
