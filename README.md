# Relayer

Typescript implementation of an [IBC](https://ibcprotocol.org/) Relayer.

To get a good overview of what it can do, please
[check our feature matrix](./FEATURES.md)

You can also read [our specification page](./spec/index.md), which explains how
the relayer works, but the Quick Start probably gives a better intro.

## Requirements

- [Node.js 14.16.1](https://nodejs.org/en/blog/release/v14.16.1/) or later
- RPC addresses of 2 full nodes on compatible, IBC-enabled chains
- See [Chain Requirements below](#Chain-Requirements) for details of what chains are supported

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
   ibc-setup init --src relayer_test_1 --dest relayer_test_2
   ```

   - creates relayer's home directory at `~/.ibc-setup`
   - creates `app.yaml` inside relayer's home with `src`, `dest` and newly generated `mnemonic`
   - pulls default `registry.yaml` to relayer's home
   - funds addresses on both sides so relayer can pay the fee while relaying packets

   > **NOTE:** Test blockchains `relayer_test_1` and `relayer_test_2` are running in the public. You do not need to start any blockchain locally to complete the quick start guide.

   > **NOTE:** Run `ibc-setup balances` to see the amount of tokens on each address.

2. Create `ics20` channel

   ```sh
   ibc-setup ics20
   ```

   - creates a new connection on source and desination chains
   - saves connection ids to `app.yaml` file
   - creates a new channel

3. Start the relayer in the verbose mode and 10s frequency polling
   ```sh
   ibc-relayer start -v --poll 10
   ```

### Send tokens between chains

1. Make sure `wasmd` binary is installed on your system

   - you must be running Linux or OSX on amd64 (not arm64/Mac M1)
   - [install Go 1.15+](https://golang.org/doc/install) and ensure that `$PATH` includes Go binaries (you may need to restart your terminal session)
   - clone and install `wasmd`:
     ```sh
     git clone https://github.com/CosmWasm/wasmd.git
     cd wasmd
     git checkout v0.15.1
     make install
     ```

2. Create a new account and fund it

   ```sh
   wasmd keys add sender
   JSON=$(jq -n --arg addr $(wasmd keys show -a sender) '{"denom":"umuon","address":$addr}')
   curl -X POST --header "Content-Type: application/json" --data "$JSON" http://49.12.73.189:8001/credit
   ```

3. Create another account to send tokens to
   ```sh
   wasmd keys add receiver
   ```
4. Send tokens
   ```sh
   wasmd tx ibc-transfer transfer transfer <channel-id> $(wasmd keys show -a receiver) 200umuon --from $(wasmd keys show -a sender) --node http://168.119.254.205:26657 --chain-id network-1 --fees 2000umuon
   ```
   - replace `<channel-id>` with the channel id obtained while configuring the relayer (2nd point)
   - if you cleared out the terminal, query the channel
     ```sh
     # replace `connection-id` with value of `srcConnection` property from `~/.ibc-setup/app.yaml` file
     ibc-setup channels --chain relayer_test_1 --connection <connection-id>
     ```
5. Observe the relayer output

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

The `GET /metrics` endpoint will be exposed by default on port `26660`, which you can override with `--metrics-port` flag, `RELAYER_METRICS_PORT` env variable, or `metricsPort` entry in `app.yaml`.

### Local setup

1. Start the relayer with metrics enabled
2. Spin up the Prometheus instance:
   ```sh
   docker run -it -v $(pwd):/prometheus -p9090:9090 prom/prometheus --config.file=demo/prometheus.yaml
   ```
   > **NOTE:** Ensure that `the --config.file=<path>` flag points at the existing configuration file. You can find an example here: [prometheus.yaml](demo/prometheus.yaml).
3. Open the Prometheus dashboard in a browser at [http://localhost:9090](http://localhost:9090)

## Development

[Refer to the development page.](DEVELOPMENT.md)

## Chain Requirements

The blockchain must be based on Cosmos SDK `v0.41.1+`. In particular it must have
[PR 8458](https://github.com/cosmos/cosmos-sdk/pull/8458) merged (if you are using a fork)
in order for the relayer to work properly. `ibc-setup` should work on `v0.40.0+`

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
