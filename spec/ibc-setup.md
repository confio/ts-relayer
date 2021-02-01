# IBC Setup Binary

This is the binary designed for interactive use. It has quite a few commands for more advanced users
to fine tune aspects. As well as a semi-automatic mode to quickly setup a relayer for a new user
(or someone who just wants to connect two testnets without taking hours).

## Automated Commands

These are the high-level entry-points that call a series of other commands.

### init

This is used once to setup a new key and configuration file:

`ibc-setup init --from=XYZ --to=ABC` will:

- check for `registry.yaml` in the home dir and if missing, will download it from a default location.
- generate a new mnemonic phrase
- initialize `app.yaml` in the home dir (if missing) with:

```yaml
from: XYZ
to: ABC
mnemonic: 'your codes here...'
```

It will then output the relayers addresses on each chain on standard out and request the admin to fill those
addresses with funds.

### ics20

This requires `registry.conf`, `app.conf` and funded accounts on both sides. If either account is not funded,
it will print a clear error message on startup. It will accept two optional flags to specify the ports on
each side, but default to `transfer` if those are not present.

`ibc-setup ics20 [--from-port=transfer] [--to-port=transfer] [--connection=connection-3]` will:

- ensure accounts have funds on both sides
- if `--connection` is not defined:
  - create a new client on both sides
  - create a new connection between these clients
- else:
  - ensure the `connection` exists and does connect the two given chains
- store the `client` and `connection` in `app.yaml`
- create a new unordered channel with version `ics20-1` between the two chains on the given connection and given port (default `transfer`)

When this is finished, there is an established connection for ics20 transfers. If you wish to establish multiple channels on
one connection, do not pass in `--connection` on the first call, but pass in the `connection_id` established by the first call
in all subsequent calls. They will share a connection/client and thus save in paying for light client proofs.

### ics27

TODO: once this is merged into Cosmos SDK, support a similar setup script as for ics20.

### Moving to a Relayer

The entire setup would be more or less the following:

```bash
ibc-setup init
# send some tokens there in your two web-wallets
ibc-setup ics20

# try out the relayer easily
ibc-relayer start --home=$HOME/.ibc-setup
```

When you want to make it a real service, you need to set up a systemd config file to run `ibc-relayer start`
and just copy over the config setup. (TODO: automate this as well?)

```bash
sudo cp -r ~/.ibc-setup /etc/relayer.d
```

## Advanced Commands

Beyond those flows listed above, we can provide some lower-level commands for those who want
to get their hands dirty, or who are busy debugging.

### Account Management

The `ibc-setup` binaries has a few commands to work with relayer keys and accounts:

- `ibc-setup keys generate` - generate a new mnemonic, either writing to a file or stdout. Does not require an existing  
  mnemonic flag. This output should be passed into a `ibc-relayer` configuration.
- `ibc-setup keys list` - given a mnemonic and the `registry.conf` file, prints out the relayer's address on all chains listed
  in the registry. This can be used to send it tokens to prepare it for running.
- `ibc-setup balances` - calculates all chain keys as above, and prints out all chains for which the relayer has a non-zero
  balance. Meant to quickly see if it is running low on one side.

### Connection Setup

TODO

### Channel Setup

TODO
