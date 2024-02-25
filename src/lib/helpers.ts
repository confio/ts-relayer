// This file outputs some basic test functionality, and includes tests that they work

import {
  SigningCosmWasmClient,
  SigningCosmWasmClientOptions,
} from "@cosmjs/cosmwasm-stargate";
import { Bip39, Random } from "@cosmjs/crypto";
import { toBech32 } from "@cosmjs/encoding";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice, StargateClient } from "@cosmjs/stargate";
import { Order } from "cosmjs-types/ibc/core/channel/v1/channel";
import sinon, { SinonSpy } from "sinon";

import { ChannelInfo, IbcClient, IbcClientOptions } from "./ibcclient";
import { Logger, LogMethod } from "./logger";

export class TestLogger implements Logger {
  public readonly error: SinonSpy & LogMethod;
  public readonly warn: SinonSpy & LogMethod;
  public readonly info: SinonSpy & LogMethod;
  public readonly verbose: SinonSpy & LogMethod;
  public readonly debug: SinonSpy & LogMethod;
  public readonly child: () => TestLogger;

  constructor(shouldLog = false) {
    const createSpy = (logFn: (message: string, meta?: string) => unknown) =>
      sinon.spy(
        ((message: string, meta?: Record<string, unknown>): Logger => {
          logFn(message, meta ? JSON.stringify(meta) : undefined);
          return this;
        }).bind(this),
      );
    const createFake = (() => sinon.fake.returns(this)).bind(this);

    this.error = shouldLog ? createSpy(console.error) : createFake();
    this.warn = shouldLog ? createSpy(console.warn) : createFake();
    this.info = shouldLog ? createSpy(console.info) : createFake();
    this.verbose = shouldLog ? createSpy(console.log) : createFake();
    this.debug = createFake();
    this.child = () => this;
  }
}

export interface AccountInfo {
  mnemonic: string;
  pubkey0: {
    type: string;
    value: string;
  };
  address0: string;
}

export interface ChainDefinition {
  tendermintUrlWs: string;
  tendermintUrlHttp: string;
  chainId: string;
  prefix: string;
  denomStaking: string;
  denomFee: string;
  minFee: string;
  blockTime: number; // ms
  ics20Port: string;
  faucet: AccountInfo;
  estimatedBlockTime: number;
  estimatedIndexerTime: number;
}

export const gaia: ChainDefinition = {
  tendermintUrlWs: "ws://localhost:26655",
  tendermintUrlHttp: "http://localhost:26655",
  chainId: "gaia-test",
  prefix: "cosmos",
  denomStaking: "uatom",
  denomFee: "uatom",
  minFee: "0.025uatom",
  blockTime: 250, // ms
  faucet: {
    mnemonic:
      "economy stock theory fatal elder harbor betray wasp final emotion task crumble siren bottom lizard educate guess current outdoor pair theory focus wife stone",
    pubkey0: {
      type: "tendermint/PubKeySecp256k1",
      value: "A08EGB7ro1ORuFhjOnZcSgwYlpe0DSFjVNUIkNNQxwKQ",
    },
    address0: "cosmos1pkptre7fdkl6gfrzlesjjvhxhlc3r4gmmk8rs6",
  },
  ics20Port: "custom",
  estimatedBlockTime: 400,
  estimatedIndexerTime: 80,
};

export const wasmd: ChainDefinition = {
  tendermintUrlWs: "ws://localhost:26659",
  tendermintUrlHttp: "http://localhost:26659",
  chainId: "testing",
  prefix: "wasm",
  denomStaking: "ustake",
  denomFee: "ucosm",
  minFee: "0.025ucosm",
  blockTime: 250, // ms
  faucet: {
    mnemonic:
      "enlist hip relief stomach skate base shallow young switch frequent cry park",
    pubkey0: {
      type: "tendermint/PubKeySecp256k1",
      value: "A9cXhWb8ZpqCzkA8dQCPV29KdeRLV3rUYxrkHudLbQtS",
    },
    address0: "wasm14qemq0vw6y3gc3u3e0aty2e764u4gs5lndxgyk",
  },
  ics20Port: "transfer",
  estimatedBlockTime: 400,
  estimatedIndexerTime: 80,
};

export const osmosis: ChainDefinition = {
  tendermintUrlWs: "ws://localhost:26653",
  tendermintUrlHttp: "http://localhost:26653",
  chainId: "osmo-testing",
  prefix: "osmo",
  denomStaking: "uosmo",
  denomFee: "uosmo",
  minFee: "0uosmo",
  blockTime: 250, // ms
  faucet: {
    mnemonic:
      "remain fragile remove stamp quiz bus country dress critic mammal office need",
    pubkey0: {
      type: "tendermint/PubKeySecp256k1",
      value: "A0d/GxY+UALE+miWJP0qyq4/EayG1G6tsg24v+cbD6By",
    },
    address0: "osmo1lvrwcvrqlc5ktzp2c4t22xgkx29q3y83hdcc5d",
  },
  ics20Port: "transfer",
  estimatedBlockTime: 400,
  estimatedIndexerTime: 80,
};

// constants for this transport protocol
// look at ChainDefinitions to find standard ics20 port
export const ics20 = {
  version: "ics20-1",
  ordering: Order.ORDER_UNORDERED,
};

export interface SigningOpts {
  readonly tendermintUrlHttp: string;
  readonly prefix: string;
  readonly denomFee: string;
  readonly minFee: string;
  readonly estimatedBlockTime: number;
  readonly estimatedIndexerTime: number;
}

interface QueryOpts {
  readonly tendermintUrlHttp: string;
}

type FundingOpts = SigningOpts & {
  readonly faucet: {
    readonly mnemonic: string;
  };
};

export async function queryClient(opts: QueryOpts): Promise<StargateClient> {
  return StargateClient.connect(opts.tendermintUrlHttp);
}

function extras(): {
  broadcastPollIntervalMs?: number;
  broadcastTimeoutMs?: number;
} {
  const extras =
    process.env.NODE_ENV == "test"
      ? {
          // This is just for tests - don't add this in production code
          broadcastPollIntervalMs: 300,
          broadcastTimeoutMs: 2000,
        }
      : {};
  return extras;
}

export async function signingClient(
  opts: SigningOpts,
  mnemonic: string,
  logger?: Logger,
): Promise<IbcClient> {
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: opts.prefix,
  });
  const { address } = (await signer.getAccounts())[0];
  const options: IbcClientOptions = {
    gasPrice: GasPrice.fromString(opts.minFee),
    logger,
    estimatedBlockTime: opts.estimatedBlockTime,
    estimatedIndexerTime: opts.estimatedIndexerTime,
    ...extras(),
  };
  const client = await IbcClient.connectWithSigner(
    opts.tendermintUrlHttp,
    signer,
    address,
    options,
  );
  return client;
}

export async function signingCosmWasmClient(
  opts: SigningOpts,
  mnemonic: string,
): Promise<CosmWasmSigner> {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: opts.prefix,
  });
  const { address: senderAddress } = (await wallet.getAccounts())[0];

  const options: SigningCosmWasmClientOptions = {
    gasPrice: GasPrice.fromString(opts.minFee),
    ...extras(),
  };
  const sign = await SigningCosmWasmClient.connectWithSigner(
    opts.tendermintUrlHttp,
    wallet,
    options,
  );

  return { sign, senderAddress };
}

export async function setupGaiaWasm(logger?: Logger): Promise<IbcClient[]> {
  return setup(gaia, wasmd, logger);
}

export async function setup(
  srcConfig: ChainDefinition,
  destConfig: ChainDefinition,
  logger?: Logger,
): Promise<IbcClient[]> {
  // create apps and fund an account
  const mnemonic = generateMnemonic();
  const src = await signingClient(srcConfig, mnemonic, logger);
  const dest = await signingClient(destConfig, mnemonic, logger);
  await fundAccount(destConfig, dest.senderAddress, "4000000");
  await fundAccount(srcConfig, src.senderAddress, "4000000");
  return [src, dest];
}

export interface CosmWasmSigner {
  readonly sign: SigningCosmWasmClient;
  readonly senderAddress: string;
}

// This creates a client for the CosmWasm chain, that can interact with contracts
export async function setupWasmClient(): Promise<CosmWasmSigner> {
  // create apps and fund an account
  const mnemonic = generateMnemonic();
  const cosmwasm = await signingCosmWasmClient(wasmd, mnemonic);
  await fundAccount(wasmd, cosmwasm.senderAddress, "4000000");
  return cosmwasm;
}

export async function fundAccount(
  opts: FundingOpts,
  rcpt: string,
  amount: string,
): Promise<void> {
  const client = await signingClient(opts, opts.faucet.mnemonic);
  const feeTokens = {
    amount,
    denom: GasPrice.fromString(opts.minFee).denom,
  };
  await client.sendTokens(rcpt, [feeTokens]);
}

export function generateMnemonic(): string {
  return Bip39.encode(Random.getBytes(16)).toString();
}

export function randomAddress(prefix: string): string {
  const random = Random.getBytes(20);
  return toBech32(prefix, random);
}

// Makes multiple transfers, one per item in amounts.
// Return a list of the block heights the packets were committed in.
export async function transferTokens(
  src: IbcClient,
  srcDenom: string,
  dest: IbcClient,
  destPrefix: string,
  channel: ChannelInfo,
  amounts: number[],
  timeout?: number,
): Promise<number[]> {
  const txHeights: number[] = [];
  const destRcpt = randomAddress(destPrefix);
  const destHeight = await dest.timeoutHeight(timeout ?? 500); // valid for 500 blocks or timeout if specified

  for (const amount of amounts) {
    const token = {
      amount: amount.toString(),
      denom: srcDenom,
    };
    const { height } = await src.transferTokens(
      channel.portId,
      channel.channelId,
      token,
      destRcpt,
      destHeight,
    );
    txHeights.push(height);
  }

  return txHeights;
}
