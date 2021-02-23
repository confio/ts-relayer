// This file outputs some basic test functionality, and includes tests that they work
import { Bip39, Random } from '@cosmjs/crypto';
import { Bech32 } from '@cosmjs/encoding';
import { Decimal } from '@cosmjs/math';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { StargateClient } from '@cosmjs/stargate';
import test from 'ava';
import sinon, { SinonSpy } from 'sinon';

import { Order } from '../codec/ibc/core/channel/v1/channel';

import { IbcClient, IbcClientOptions } from './ibcclient';
import { Logger } from './logger';

export class TestLogger implements Logger {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  public readonly error: SinonSpy &
    ((message: string, ...meta: any[]) => Logger);
  public readonly warn: SinonSpy &
    ((message: string, ...meta: any[]) => Logger);
  public readonly info: SinonSpy &
    ((message: string, ...meta: any[]) => Logger);
  public readonly verbose: SinonSpy &
    ((message: string, ...meta: any[]) => Logger);
  public readonly debug: SinonSpy &
    ((message: string, ...meta: any[]) => Logger);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  constructor() {
    this.error = sinon.fake.returns(this);
    this.warn = sinon.fake.returns(this);
    this.info = sinon.fake.returns(this);
    this.verbose = sinon.fake.returns(this);
    this.debug = sinon.fake.returns(this);
  }
}

export const simapp = {
  tendermintUrlWs: 'ws://localhost:26658',
  tendermintUrlHttp: 'http://localhost:26658',
  chainId: 'simd-testing',
  prefix: 'cosmos',
  denomStaking: 'ustake',
  denomFee: 'ucosm',
  blockTime: 1_000, // ms
  faucet: {
    mnemonic:
      'economy stock theory fatal elder harbor betray wasp final emotion task crumble siren bottom lizard educate guess current outdoor pair theory focus wife stone',
    pubkey0: {
      type: 'tendermint/PubKeySecp256k1',
      value: 'A08EGB7ro1ORuFhjOnZcSgwYlpe0DSFjVNUIkNNQxwKQ',
    },
    address0: 'cosmos1pkptre7fdkl6gfrzlesjjvhxhlc3r4gmmk8rs6',
  },
  /** Unused account */
  unused: {
    pubkey: {
      type: 'tendermint/PubKeySecp256k1',
      value: 'ArkCaFUJ/IH+vKBmNRCdUVl3mCAhbopk9jjW4Ko4OfRQ',
    },
    address: 'cosmos1cjsxept9rkggzxztslae9ndgpdyt2408lk850u',
    accountNumber: 16,
    sequence: 0,
    balanceStaking: '10000000', // 10 STAKE
    balanceFee: '1000000000', // 1000 COSM
  },
};

export const wasmd = {
  tendermintUrlWs: 'ws://localhost:26659',
  tendermintUrlHttp: 'http://localhost:26659',
  chainId: 'testing',
  prefix: 'wasm',
  denomStaking: 'ustake',
  denomFee: 'ucosm',
  blockTime: 1_000, // ms
  faucet: {
    mnemonic:
      'enlist hip relief stomach skate base shallow young switch frequent cry park',
    pubkey0: {
      type: 'tendermint/PubKeySecp256k1',
      value: 'A9cXhWb8ZpqCzkA8dQCPV29KdeRLV3rUYxrkHudLbQtS',
    },
    address0: 'wasm14qemq0vw6y3gc3u3e0aty2e764u4gs5lndxgyk',
  },
  unused: {
    pubkey: {
      type: 'tendermint/PubKeySecp256k1',
      value: 'ArkCaFUJ/IH+vKBmNRCdUVl3mCAhbopk9jjW4Ko4OfRQ',
    },
    address: 'wasm1cjsxept9rkggzxztslae9ndgpdyt240842kpxh',
    accountNumber: 16,
    sequence: 0,
    balanceStaking: '10000000', // 10 STAKE
    balanceFee: '1000000000', // 1000 COSM
  },
};

// constants for this transport protocol
// we assume src = simapp, dest = wasmd as returned by setup()
export const ics20 = {
  // we set a new port in genesis for simapp
  srcPortId: 'custom',
  destPortId: 'transfer',
  version: 'ics20-1',
  ordering: Order.ORDER_UNORDERED,
};

interface SigningOpts {
  readonly tendermintUrlHttp: string;
  readonly prefix: string;
  readonly denomFee: string;
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

export async function signingClient(
  opts: SigningOpts,
  mnemonic: string,
  logger?: Logger
): Promise<IbcClient> {
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(
    mnemonic,
    undefined,
    opts.prefix
  );
  const { address } = (await signer.getAccounts())[0];
  const options: IbcClientOptions = {
    prefix: opts.prefix,
    gasPrice: {
      amount: Decimal.fromAtomics('5', 2), // 0.05
      denom: opts.denomFee,
    },
    logger,
  };
  const client = await IbcClient.connectWithSigner(
    opts.tendermintUrlHttp,
    signer,
    address,
    options
  );
  return client;
}

export async function setup(logger?: Logger): Promise<IbcClient[]> {
  // create apps and fund an account
  const mnemonic = generateMnemonic();
  const src = await signingClient(simapp, mnemonic, logger);
  const dest = await signingClient(wasmd, mnemonic, logger);
  await fundAccount(wasmd, dest.senderAddress, '200000');
  await fundAccount(simapp, src.senderAddress, '200000');
  return [src, dest];
}

export async function fundAccount(
  opts: FundingOpts,
  rcpt: string,
  amount: string
): Promise<void> {
  const client = await signingClient(opts, opts.faucet.mnemonic);
  const feeTokens = {
    amount,
    denom: opts.denomFee,
  };
  await client.sendTokens(rcpt, [feeTokens]);
}

export function generateMnemonic(): string {
  return Bip39.encode(Random.getBytes(16)).toString();
}

export function randomAddress(prefix: string): string {
  const random = Random.getBytes(20);
  return Bech32.encode(prefix, random);
}

test('query account balance - simapp', async (t) => {
  const client = await queryClient(simapp);
  const account = await client.getAllBalancesUnverified(simapp.unused.address);
  t.is(account.length, 2);
  t.deepEqual(account[0], { amount: '1000000000', denom: simapp.denomFee });
  t.deepEqual(account[1], { amount: '10000000', denom: simapp.denomStaking });
});

test('query account balance - wasmd', async (t) => {
  const client = await queryClient(wasmd);
  const account = await client.getAllBalancesUnverified(wasmd.unused.address);
  t.is(account.length, 2);
  t.deepEqual(account[0], { amount: '1000000000', denom: wasmd.denomFee });
  t.deepEqual(account[1], { amount: '1000000000', denom: wasmd.denomStaking });
});

test.serial('send initial funds - simapp', async (t) => {
  const client = await queryClient(simapp);
  const newbie = randomAddress(simapp.prefix);

  // account empty at start
  let account = await client.getAllBalancesUnverified(newbie);
  t.deepEqual(account, []);

  // let's send some tokens
  await fundAccount(simapp, newbie, '500');

  // account has tokens
  account = await client.getAllBalancesUnverified(newbie);
  t.is(account.length, 1);
  t.deepEqual(account[0], { amount: '500', denom: simapp.denomFee });
});

test.serial('send initial funds - wasmd', async (t) => {
  const client = await queryClient(wasmd);
  const newbie = randomAddress(wasmd.prefix);

  // account empty at start
  let account = await client.getAllBalancesUnverified(newbie);
  t.deepEqual(account, []);

  // let's send some tokens
  await fundAccount(wasmd, newbie, '500');

  // account has tokens
  account = await client.getAllBalancesUnverified(newbie);
  t.is(account.length, 1);
  t.deepEqual(account[0], { amount: '500', denom: wasmd.denomFee });
});
