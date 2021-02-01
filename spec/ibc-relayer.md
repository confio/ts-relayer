# IBC Relayer

The IBC Relayer is a simple binary with one command: `start`. When run, it will read configuration
data and then seek to continually relay all packets over all channels on it's pre-configured connection.

The most interesting elements of the Relayer is [configuring it's logging](./logging.md) for easy debugging,
as well as [checking metrics](./metrics.md) to set up alerts or Grafana dashboards.
