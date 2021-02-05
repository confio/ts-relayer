// This file outputs some basic test functionality, and includes tests that they work
import { Random } from '@cosmjs/crypto';
import { Bech32 } from '@cosmjs/encoding';
import { Decimal } from '@cosmjs/math';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import {
  isBroadcastTxFailure,
  SigningStargateClient,
  StargateClient,
} from '@cosmjs/stargate';
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

interface SigningInfo {
  client: SigningStargateClient;
  address: string;
}

export async function queryClient(opts: QueryOpts): Promise<StargateClient> {
  return StargateClient.connect(opts.tendermintUrlHttp);
}

export async function signingClient(
  opts: SigningOpts,
  mnemonic: string
): Promise<SigningInfo> {
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(
    mnemonic,
    undefined,
    opts.prefix
  );
  const { address } = (await signer.getAccounts())[0];
  const options: SigningStargateClientOptions = {
    prefix: opts.prefix,
    gasPrice: {
      amount: Decimal.fromAtomics('5', 2), // 0.05
      denom: opts.denomFee,
    },
  };
  const client = await SigningStargateClient.connectWithSigner(
    opts.tendermintUrlHttp,
    signer,
    options
  );
  return { address, client };
}

export async function fundAccount(
  opts: FundingOpts,
  rcpt: string,
  amount: string
): Promise<void> {
  const { address, client } = await signingClient(opts, opts.faucet.mnemonic);
  const feeTokens = {
    amount,
    denom: opts.denomFee,
  };
  const resp = await client.sendTokens(address, rcpt, [feeTokens]);
  if (isBroadcastTxFailure(resp)) {
    throw new Error(`funding failed (${resp.code}) ${resp.rawLog}`);
  }
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
