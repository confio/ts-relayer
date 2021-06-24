import { GasPrice } from '@cosmjs/stargate';

export type GasLimits = {
  init_client?: number;
  update_client?: number;
  init_connection?: number;
  connection_handshake?: number;
  init_channel?: number;
  channel_handshake?: number;
  receive_packet?: number;
  ack_packet?: number;
  timeout_packet?: number;
  transfer?: number;
};

export type Chain = {
  chain_id: string;
  prefix: string;
  gas_price: string;
  gas_limits?: GasLimits;
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
