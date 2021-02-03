import { OfflineSigner, Registry } from '@cosmjs/proto-signing';
import {
  AuthExtension,
  BankExtension,
  codec,
  IbcExtension,
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

const { MsgMultiSend } = codec.cosmos.bank.v1beta1;
// const {} = codec.ibc.core.connection.v1;
// const {} = codec.ibc.core.connection.v1.;

function ibcRegistry(): Registry {
  return new Registry([
    ['/cosmos.bank.v1beta1.MsgMultiSend', MsgMultiSend],
    // TODO: add ibc messages when present
  ]);
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
}
