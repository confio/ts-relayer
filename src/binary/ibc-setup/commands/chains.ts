/** This is info for tests **/

export const gaiaChain = {
  prefix: 'cosmos',
  chain_id: 'gaia-testing',
  gas_price: '0.025uatom',
  rpc: ['http://localhost:26655'],
  ics20Port: 'custom',
};

export const wasmdChain = {
  prefix: 'wasm',
  chain_id: 'testing',
  gas_price: '0.025ucosm',
  rpc: ['http://localhost:26659'],
  ics20Port: 'transfer',
};
