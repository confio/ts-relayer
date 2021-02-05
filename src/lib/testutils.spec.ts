// This file outputs some basic test functionality, and includes tests that they work
import { Decimal } from '@cosmjs/math';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { SigningStargateClient, StargateClient } from '@cosmjs/stargate';
import { SigningStargateClientOptions } from '@cosmjs/stargate/types/signingstargateclient';
import test from 'ava';

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
  facuet: {
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

interface SigningOpts {
  readonly tendermintUrlHttp: string;
  readonly prefix: string;
  readonly denomFee: string;
}

interface QueryOpts {
  readonly tendermintUrlHttp: string;
}

export async function queryClient(opts: QueryOpts): Promise<StargateClient> {
  return StargateClient.connect(opts.tendermintUrlHttp);
}

export async function signingClient(
  opts: SigningOpts,
  mnemonic: string
): Promise<SigningStargateClient> {
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(
    mnemonic,
    undefined,
    opts.prefix
  );
  const options: SigningStargateClientOptions = {
    prefix: opts.prefix,
    gasPrice: {
      amount: Decimal.fromAtomics('5', 2), // 0.05
      denom: opts.denomFee,
    },
  };
  return SigningStargateClient.connectWithSigner(
    opts.tendermintUrlHttp,
    signer,
    options
  );
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
