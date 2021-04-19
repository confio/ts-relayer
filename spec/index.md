# Relayer Binary

The relayer binary is designed to connect to two chains, create a connection if needed,
create channels on demands, and relay a selected subset of packets between the two chains.
It is designed to run on a secure machine and must be provided with a funded account on
each chain. If you wish to connect multiple chains, please run one (or more) relayer for
each pair you wish to connect.

Informal systems provides a good [overview of a relayer](https://github.com/informalsystems/ibc-rs/blob/master/docs/architecture/adr-002-ibc-relayer.md) in their `ibc-rs` repo. This image is borrowed from there.

![Relayer Architecture](https://raw.githubusercontent.com/informalsystems/ibc-rs/master/docs/architecture/assets/IBC_relayer.jpeg)

We have split the relayer into 2 binaries for two different use cases, to ensure we cover both
cases best:

- `ibc-setup` - this is an interacticve admin tool, used to create keys, setup clients and connections,
  and any other one-time tasks run by a human.
- `ibc-relayer` - this is designed to run as a daemon (service), controlled by env variable and config files
  and with instrumentation (logging, metrics, etc) fit for running unattended in a production environment.

1. [Configuration](./config.md)
2. [Key Management](./keys.md)
3. [IBC Setup Functions](./ibc-setup.md)
4. [IBC Relayer Functionality](./ibc-relayer.md)
5. [Logging Framework](./logging.md)
6. [Ops and Metrics](./metrics.md)
7. [Future Work](./future-work.md)
