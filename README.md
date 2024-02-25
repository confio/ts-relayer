# Relayer

[![npm version](https://img.shields.io/npm/v/@confio/relayer.svg)](https://www.npmjs.com/package/@confio/relayer)

TypeScript implementation of an [IBC](https://www.ibcprotocol.dev/) Relayer.

To get a good overview of what it can do, please
[check our feature matrix](./FEATURES.md)

You can also read [our specification page](./spec/index.md), which explains how
the relayer works, but the Quick Start probably gives a better intro.

This repo is mainly used as a node binary to perform IBC relaying. However, all logic is
available in the library, which can be run equally well in the browser or in Node.
You can see an example of embedding the relayer in a [webapp below](#Web-App).

## Requirements

- [Node.js](https://nodejs.org/) 18 or later
- RPC addresses of 2 full nodes on compatible, IBC-enabled chains
- See [Chain Requirements below](#Chain-Requirements) for details of what chains are supported

## Important Note

Versions until `v0.1.6` support Cosmos SDK `v0.41.1+`.
From `v0.2.0` on we require Tendermint `v0.34.9+` (which is used in SDK `v0.42.4+`).
If you are connecting to a v0.41 chain, please use the `v0.1.x` relayer.

With `v0.2.0` we add support for relaying packets in BeginBlock and EndBlock. However, this requires
an extra rpc endpoint in Tendermint that is not available in `v0.41.1`. We therefore increase the
minimum compatible version of the SDK.

## Installation

### NPM

Install the [latest release](https://github.com/confio/ts-relayer/releases/latest).

```sh
npm i -g @confio/relayer
```

Alternatively, install from the `main` branch.

```sh
npm i -g @confio/relayer@main
```

> **NOTE:** We do a manual release after completing a predefined milestone or when it feels right. No release schedule is in place <em>yet</em>. To utilize the latest changes, use the `main` tag during the installation.

## Usage

After installation, `ibc-setup` and `ibc-relayer` executables are available.

### ibc-setup

Collection of commands to quickly setup a relayer and query IBC/chain data.

- run `ibc-setup --help` to print usage
- [ibc-setup spec](spec/ibc-setup.md)

### ibc-relayer

Reads the configuration and starts relaying packets.

- run `ibc-relayer --help` to print usage
- [ibc-relayer spec](spec/ibc-relayer.md)

## Quick start

### Configure and start the relayer

1. Init the configuration

   ```sh
   ibc-setup init --src malaga --dest uni
   ```

   - creates relayer's home directory at `~/.ibc-setup`
   - creates `app.yaml` inside relayer's home with `src`, `dest` and newly generated `mnemonic`
   - pulls default `registry.yaml` to relayer's home
   - funds addresses on `malaga` so relayer can pay the fee while relaying packets

   > **NOTE:** Both testnets are running in the public. You do not need to start any blockchain locally to complete the quick start guide.

   > **NOTE:** Run `ibc-setup balances` to see the amount of tokens on each address.

2. Get testnet tokens for `uni`

   - Find your relayer address on uni via: `ibc-setup keys list | grep uni`
   - Join Juno discord with [this invite link](https://discord.gg/NbB8zCPX)
   - Go to the `faucet` channel
   - Request tokens at this address in the above channel: `$request iaa1fxmqew9dgg44jdf3l34zwa8rx7tcf42wz8ehjk`
   - Check you have tokens on malaga and uni via `ibc-setup balances`

   See [original instructions](https://docs.junonetwork.io/validators/joining-the-testnets#get-some-testnet-tokens)

3. Create `ics20` channel

   ```sh
   ibc-setup ics20 -v
   ```

   - creates a new connection on source and desination chains
   - saves connection ids to `app.yaml` file
   - creates a new channel

4. Start the relayer in the verbose mode and 10s frequency polling
   ```sh
   ibc-relayer start -v --poll 15
   ```

### Send tokens between chains

1. Make sure `wasmd` binary is installed on your system

   - you must be running Linux or OSX on amd64 (not arm64/Mac M1)
   - [install Go 1.17+](https://golang.org/doc/install) and ensure that `$PATH` includes Go binaries (you may need to restart your terminal session)
   - clone and install `wasmd`:
     ```sh
     git clone https://github.com/CosmWasm/wasmd.git
     cd wasmd
     git checkout v0.27.0
     make install
     ```

2. Make sure `juno` binary is installed on your system

   - you must be running Linux or OSX on amd64
   - [install Go 1.17+](https://golang.org/doc/install) and ensure that `$PATH` includes Go binaries (you may need to restart your terminal session)
   - clone and install `juno`:
     ```sh
     git clone https://github.com/CosmosContracts/juno
     cd juno
     git checkout v6.0.0
     make install
     ```

3. Create a new account and fund it

   ```sh
   wasmd keys add sender
   JSON=$(jq -n --arg addr $(wasmd keys show -a sender) '{"denom":"usponge","address":$addr}')
   curl -X POST --header "Content-Type: application/json" --data "$JSON" https://faucet.malaga.cosmwasm.com/credit
   ```

4. Create a valid IRISnet address to send tokens to

   ```sh
   junod keys add receiver
   ```

   [Get testnet tokens](https://docs.junonetwork.io/validators/joining-the-testnets#get-some-testnet-tokens) if you want to send tokens to `malaga`.

5. Send tokens
   ```sh
   wasmd tx ibc-transfer transfer transfer <channel-id> $(junod keys show -a receiver) 200usponge --from $(wasmd keys show -a sender) --node http://rpc.malaga.cosmwasm.com:80 --chain-id malaga-1 --fees 2000usponge --packet-timeout-height 0-0
   ```
   - replace `<channel-id>` with the channel id obtained while configuring the relayer (2nd point)
   - if you cleared out the terminal, query the channel
     ```sh
     ibc-setup channels --chain malaga
     ```
6. Observe the relayer output

## Configuration overview

The relayer configuration is stored under relayer's home directory. By default, it's located at `$HOME/.ibc-setup`, however, can be customized with `home` option, e.g.:

```sh
# initialize the configuration at /home/user/relayer_custom_home
ibc-setup init --home /home/user/relayer_custom_home

# read the configuration from /home/user/relayer_custom_home
ibc-relayer start --home /home/user/relayer_custom_home
```

There are 3 files that live in the relayer's home.

- **registry.yaml** (required)

  Contains a list of available chains with corresponding information. The chains from the registry can be referenced by `ibc-setup` binary or within the `app.yaml` file. [View an example of registry.yaml file.](demo/registry.yaml)

- **app.yaml** (optional)

  Holds the relayer-specific options such as source or destination chains. These options can be overridden with CLI flags or environment variables.

- **last-queried-heights.json** (optional)

  Stores last queried heights for better performance on relayer startup. It's constantly overwritten with new heights when relayer is running. Simply delete this file to scan the events since forever.

[Learn more about configuration.](spec/config.md)

## Monitoring

The relayer collects various metrics that a [Prometheus](https://prometheus.io/docs/introduction/overview/) instance can consume.

To enable metrics collection, pass the `--enable-metrics` flag when starting the relayer:

```sh
ibc-relayer start --enable-metrics
```

> **NOTE:** Metrics can also be enabled via an environment variable `RELAYER_ENABLE_METRICS=true`, or with an `enableMetrics: true` entry in the `app.yaml` file, as explained in the [config specification](./spec/config.md#configuration).

The `GET /metrics` endpoint will be exposed by default on port `8080`, which you can override with `--metrics-port` flag, `RELAYER_METRICS_PORT` env variable, or `metricsPort` entry in `app.yaml`.

### Local setup

#### Prometheus

1. Start the relayer with metrics enabled
2. Spin up the Prometheus instance:
   ```sh
   docker run -it -v $(pwd):/prometheus -p9090:9090 prom/prometheus --config.file=demo/prometheus.yaml
   ```
   > **NOTE:** Ensure that `the --config.file=<path>` flag points at the existing configuration file. If you wish to use [the example config](demo/prometheus.yaml), just run the command above in the root of this repository. Otherwise, you must adjust the volume (`-v`) and config file path to your setup.
3. Open the Prometheus dashboard in a browser at [http://localhost:9090](http://localhost:9090)

#### Grafana

1. Spin up the Grafana instance:
   ```sh
   docker run -d --name=grafana -p 3000:3000 grafana/grafana
   ```
2. Navigate to [http://localhost:3000](http://localhost:3000) and log in (`admin`/`admin`)
3. [Create a Prometheus data source](https://prometheus.io/docs/visualization/grafana/#creating-a-prometheus-data-source)
   > **NOTE:** Use `http://host.docker.internal:9090` as the server URL and `Server` as the Access method.
4. Create a new graph and query data
   > **NOTE:** Useful guides:
   - https://grafana.com/docs/grafana/latest/getting-started/getting-started/#step-3-create-a-dashboard
   - https://prometheus.io/docs/visualization/grafana/#creating-a-prometheus-graph

## Development

[Refer to the development page.](DEVELOPMENT.md)

## Integration Tests

ts-relayer can be used as a library as well as a binary. This allows us to make powerful node scripts, or to
easily test CosmWasm contract IBC flows in CI code. You can look at the following two examples on how to do so:

- [Simple CW20-ICS20 talking to non-CosmWasm node](https://github.com/confio/ibc-tests-ics20)
- [A pair of CosmWasm contracts talking on multiple chains](https://github.com/confio/cw-ibc-demo/tree/main/tests)

## Chain Requirements

The blockchain must be based on Cosmos SDK `v0.42.4+`. In particular it must have
[PR 8458](https://github.com/cosmos/cosmos-sdk/pull/8458) and [PR 9081](https://github.com/cosmos/cosmos-sdk/pull/9081)
merged (if you are using a fork) in order for the relayer to work properly. `ibc-setup` should work on `v0.40.0+`

The chain must have a large value for `staking.params.historical_entries` (often set in genesis).
The default is "10000" and this should work with "1000", but no relayer will work if it is set to 0.

### Full Node Requirements

Ideally you are in control of the node that the relayer connects to. If not, it should be run
by a known and trusted party, whom you can check the configuration with. Note that a malicious node
could cause the relayer to send invalid packets and waste tokens on gas (but not create invalid state).

The indexer should be enabled (`tx_index.indexer = "kv"` in `config.toml`),
and all events should be indexed (`index-events = []` in `app.toml`).

The node must support historical queries. `--pruning=nothing` will definitely work, but will use an
enormous amount of disk space. You can also trim it to 3 weeks of data with
`--pruning=custom --pruning-keep-recent=362880 --pruning-keep-every=0 --pruning-interval=100`, which has been
tested. It is likely you could reduce `pruning-keep-recent` to as low as, say, 3600, but that would need testing.

## Web App

This repo can also be imported as a library and used in a web app. @clockworkgr has been so nice
to share a [sample Vue.js app using the relayer](https://github.com/clockworkgr/ts-relayer-example).
This includes some nice code samples to
[send a IbcTransfer message with CosmJS](https://github.com/clockworkgr/ts-relayer-example/blob/main/src/App.vue#L153-L186)
as well as [setting up](https://github.com/clockworkgr/ts-relayer-example/blob/main/src/App.vue#L218-L289)
and [running the relayer](https://github.com/clockworkgr/ts-relayer-example/blob/main/src/App.vue#L187-L207).

![screenshot](https://user-images.githubusercontent.com/6826762/116312118-b3f40e00-a7b4-11eb-879b-ce3135764460.png)

The key import is `import { IbcClient, Link } from "@confio/relayer/build";`
