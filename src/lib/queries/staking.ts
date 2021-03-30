import { createRpc, QueryClient } from '@cosmjs/stargate';

import { QueryClientImpl } from '../../codec/cosmos/staking/v1beta1/query';
import { Params } from '../../codec/cosmos/staking/v1beta1/staking';

export interface StakingExtension {
  readonly staking: {
    readonly params: () => Promise<Params | undefined>;
  };
}

export function setupStakingExtension(base: QueryClient): StakingExtension {
  const rpc = createRpc(base);
  // Use these services to get easy typed access to query methods
  // These cannot be used for proof verification
  const queryService = new QueryClientImpl(rpc);

  return {
    staking: {
      params: async () => {
        const resp = await queryService.Params({});
        return resp.params;
      },
    },
  };
}
