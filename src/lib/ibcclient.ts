import { coins, logs, StdFee } from '@cosmjs/launchpad';
import { OfflineSigner, Registry } from '@cosmjs/proto-signing';
import {
  AuthExtension,
  BankExtension,
  BroadcastTxFailure,
  defaultRegistryTypes,
  IbcExtension,
  isBroadcastTxFailure,
  parseRawLog,
  QueryClient,
  setupAuthExtension,
  setupBankExtension,
  setupIbcExtension,
  SigningStargateClient,
} from '@cosmjs/stargate';
// TODO: this is wrong, expose in top level
import { SigningStargateClientOptions } from '@cosmjs/stargate/types/signingstargateclient';
import {
  adaptor34,
  CommitResponse,
  Client as TendermintClient,
} from '@cosmjs/tendermint-rpc';

import { Any } from '../codec/google/protobuf/any';
import {
  MsgCreateClient,
  // MsgUpdateClient,
} from '../codec/ibc/core/client/v1/tx';

function ibcRegistry(): Registry {
  return new Registry([
    ...defaultRegistryTypes,
    // ['/ibc.core.client.v1.MsgClearAdmin', MsgCreateClient],
    // ['/ibc.core.client.v1.MsgExecuteContract', MsgUpdateClient],
  ]);
}

/// This is the default message result with no extra data
export interface MsgResult {
  readonly logs: readonly logs.Log[];
  /** Transaction hash (might be used as transaction ID). Guaranteed to be non-empty upper-case hex */
  readonly transactionHash: string;
}

function createBroadcastTxErrorMessage(result: BroadcastTxFailure): string {
  return `Error when broadcasting tx ${result.transactionHash} at height ${result.height}. Code: ${result.code}; Raw log: ${result.rawLog}`;
}

export class IbcClient {
  public readonly signingClient: SigningStargateClient;
  public readonly queryClient: QueryClient &
    AuthExtension &
    BankExtension &
    IbcExtension;
  public readonly tmClient: TendermintClient;

  public static async connectWithSigner(
    endpoint: string,
    signer: OfflineSigner,
    options?: SigningStargateClientOptions
  ): Promise<IbcClient> {
    // override any registry setup, use the other options
    const registryOptions = { ...options, registry: ibcRegistry() };
    const signingClient = await SigningStargateClient.connectWithSigner(
      endpoint,
      signer,
      registryOptions
    );
    const tmClient = await TendermintClient.connect(endpoint, adaptor34);
    return new IbcClient(signingClient, tmClient);
  }

  private constructor(
    signingClient: SigningStargateClient,
    tmClient: TendermintClient
  ) {
    this.signingClient = signingClient;
    this.tmClient = tmClient;
    this.queryClient = QueryClient.withExtensions(
      tmClient,
      setupAuthExtension,
      setupBankExtension,
      setupIbcExtension
    );
  }

  public getCommit(height?: number): Promise<CommitResponse> {
    return this.tmClient.commit(height);
  }

  public getChainId(): Promise<string> {
    return this.signingClient.getChainId();
  }

  // TODO: make a tendermint specific version
  public async createClient(
    senderAddress: string,
    clientState: Any,
    consensusState: Any
  ): Promise<MsgResult> {
    const createMsg = {
      typeUrl: '/ibc.core.client.v1.MsgClearAdmin',
      value: MsgCreateClient.fromPartial({
        signer: senderAddress,
        clientState,
        consensusState,
      }),
    };

    // TODO: use lookup table, proper values here
    const fee: StdFee = {
      amount: coins(5000, 'ucosm'),
      gas: '1000000',
    };

    const result = await this.signingClient.signAndBroadcast(
      senderAddress,
      [createMsg],
      fee
    );
    if (isBroadcastTxFailure(result)) {
      throw new Error(createBroadcastTxErrorMessage(result));
    }
    const parsedLogs = parseRawLog(result.rawLog);
    // const contractAddressAttr = logs.findAttribute(
    //   parsedLogs,
    //   'message',
    //   'contract_address'
    // );
    return {
      // contractAddress: contractAddressAttr.value,
      logs: parsedLogs,
      transactionHash: result.transactionHash,
    };
  }
}
