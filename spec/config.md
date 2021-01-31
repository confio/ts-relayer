# Configuration

While most of the commands will be specified via command-line flags, it would be very
tedious to pass in all configuration options everytime. Thus, we allow 3 ways to configure
most items - config file (yaml), environmental variables, and command line flags. With the
later taking precedence over the former. Environmental variables will all begin with `RELAYER_`.

## Config File Location

All files will be looked for relative to a "home" directory. As this is meant to be run
as a daemon (unix service), the default home directory will be `/etc/relayer.d`. This may
be overriden via the `RELAYER_HOME` env variable, or `--home` CLI flag.

## Registry Format

The principle config file is `registry.conf`, which is a required file and is encoded
in yaml format. It contains all the chain-specific information needed to connect to them.
They are all considered to be Cosmos SDK chains and compatible with 0.41. We may make changes
in a future version (thus all files are versioned as 1).

```yaml
version: 1

chains:
  - musselnet:
      - chain_id: musselnet-2
      # bech32 prefix for addresses
      - prefix: wasm
      # the path we use to derive the private key from the mnemonic
      - hd_path: 44'/108'/0'/1'
      - rpc:
          - https://rpc.musselnet.cosmwasm.com:443
          - https://rpc.musselnet.aneka.com:443
  - bifrost:
    # ...
```

The chains variable is a lookup based on human-friendly chain names (can be different that the chain_id).
It should contain all needed info to configure a relayer connection to that chain.

## Chain Selection

Every command will need to know what chains to connect to. The registry file may contain dozens of different
chains and be reused by validators making various connections. We just need to pass in a pair of names to each
command, so it can look up all needed configuration.

CLI: `--from=musselnet` and `--to=bifrost` will define the two chains to connect to, as well as the direction.
If creating a connection/channel, we init on the "from" side. If relaying packets, we may relay packets from
one chain to another (some configurations will be bi-directional).

ENV: `RELAYER_FROM=stargate` and `RELAYER_TO=musselnet` will define the two sides and be used if the command line
flags are not present.

File: If neither cli flags nor env vars are present, the relayer will look for `link.conf` in the home directory.
Referring to the file means that only one link can run, and the other options are preferred if you want to run
multiple links on one machine. The format of `link.conf` is as follows:

```yaml
from: musselnet
to: stargate
```
