# Changelog

## 0.12.0

### Minor Changes

- e07e0c2: Bump min Node.js version to 18 and remove lodash dependency

### Patch Changes

- 347ba8c: fix header failed basic validation error for app version != 0

## 0.11.3

### Patch Changes

- 36e7f68: Remove unused direct protobufjs dependency
- 2a0b251: Bump prettier to version 3 and reformat code
- b158173: Bump tsconfig-paths to 3.15.0
- 24efe38: Bump axios dependency to ^1.6.7

## 0.11.2

### Patch Changes

- fa4e21a: Switching to tx events from deprecated tx raw logs

## 0.11.1

### Patch Changes

- 7356b9f: Bump CosmJS to 0.32.1

## 0.11.0

### Minor Changes

- 81b58b5: Bumps cosmjs and cosmjs-types versions to add Cosmos SDK 0.50.0 support
- c07063a: Support for packet level filtering

### Patch Changes

- d8c346f: Use double quotes in codebase (prettier default)

## 0.10.0

### Minor Changes

- 5a1bcf7: Upgrade CosmJS to 0.31 and cosmjs-types to 0.8.0
- f58cd28: Add support for tendermint37 RPC

### Patch Changes

- 3c7a32c: Disable publish-main-tag CI job

## 0.9.0

### Minor Changes

- fe11c40: Use events instead of log parsing
- f2957f1: Upgrade CosmJS to 0.30

### Patch Changes

- 7340fad: Add txEvents to AckWithMetadata, allowing users to receive error messages of error acks

## 0.8.0

### Minor Changes

- 8d27523: Add txHash to AckWithMetadata

### Patch Changes

- 28a149d: Upgrade CosmJS to 0.29.5 and use lossy fromUtf8 implementation from @cosmjs/encoding

## 0.7.0

### Minor Changes

- ae12a8a: Fix event parsing in cases where more than one IBC packet is emitted in a transaction.
  Removed the "No message.sender nor message.signer" warning and the unused field `PacketWithMetadata.sender`.

### Patch Changes

- 347a2fa: Fix demo yamls by removing trailing commas
- 85dff13: Upgrade CosmJS to 0.29.2 and use new `isDefined`
- 387295a: Fix Uint8Array to string conversion in parsePacketsFromBlockResult
- 90a2135: Create test for parsePacketsFromLogs

## 0.6.1

### Patch Changes

- 96dec9f: Bump TypeScript build target to es2018 (same as CosmJS)

## 0.6.0

### Minor Changes

- 8bff22b: Make estimated block and indexer times configurable.
  They are now required in the registry.yaml file.
- 71f5c64: Upgrade codebase to CosmJS 0.29 and adapt code

### Patch Changes

- 898baa6: Dependency upgrades in the build and test system
- fdfe86e: Wait for indexer instead of whole block in doCheckAndRelay
- febc210: Remove open-cli dependency
- 2763798: Document how to use this as a library for integration tests

## 0.5.1

### Patch Changes

- 54eba2e: Reorganize CI files for blockchains
- da204f2: Rename testutils.ts to helpers.ts so it will be published
- da204f2: Ensure build/index.js exposed when publishing

## 0.5.0

### Minor Changes

- 0d4ae52: Update CosmJS to 0.28
- fbafd9e: Reorganize code to make external integration test packages easier

### Patch Changes

- 8eb2b09: Remove all references to simapp
- e12140b: Update wasmd to 0.27.0
- e7130e6: Bump gaia to 7.0.1 in CI
- 2434573: Update registry to use malaga, uni. Remove obsolete networks.
- 29b22b7: Upgrade follow-redirects to 1.14.7 due to advisory https://github.com/advisories/GHSA-74fj-2j2h-c42q
- ee0eddc: Update default contracts to v0.13.1
- f5b7e85: Update config entries for juno and osmosis
- b9a352b: Add Osmosis node to CI tests

## 0.4.0

### Minor Changes

- af6f99a: Use cosmjs-types for the IBC types
- 8d2d1ba: Update to CosmJS 0.27
- 93087da: Auto-calculate gas for all transactions, remove gas_limit config field

### Patch Changes

- f15b498: Update gaiad to v6.0.0 in CI
- c48b87c: Upgrade ts-proto, regenerate codec and fix handling of pagination keys
- af6f99a: Update CI to test wasmd 0.21

## 0.3.1

### Patch Changes

- 3e0ade2: Fix misusage of commander for async actions
- 97c5530: Avoid the usage of Long constructor with one argument

## 0.3.0

### Minor Changes

- ca2b9fe: Update cosmjs to 0.26

## 0.2.1

### Patch Changes

- c8408bb: Added Juno testnet details to registry
- efe3d0d: Update yarn dependencies

## 0.2.0

### Minor Changes

- b124983: Added the handling of begin and end block events

### Patch Changes

- 8589c03: Added the ability to specify custom gas limits for each chain

## 0.1.6

### Patch Changes

- a4c9a31: Update relayer demo to use oysternet and nyancat
- 2a955ea: Add home option to ics20 command
- 9e4a5c3: Update deps, faster polling for tests

## 0.1.5

### Patch Changes

- 486a7db: Update CosmJS to 0.25.3
- 486a7db: Test against wasmd 0.16.0 in CI

## 0.1.4

### Patch Changes

- 19664fd: Add support for Prometheus monitoring.
  Read more: https://github.com/confio/ts-relayer#monitoring
- 9a27b3a: Upgrade all the `@cosmjs/*` dependencies to `0.25.0`.
- 190fb61: Setup changesets to keep the changelog up to date.
- a671206: Add "how to setup local Grafana with Prometheus" section to the README.md.

## 0.1.0 - 0.1.3

- No changelog
