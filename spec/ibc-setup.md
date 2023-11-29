# IBC Setup Binary

This is the binary designed for interactive use. It has quite a few commands for more advanced users
to fine tune aspects. As well as a semi-automatic mode to quickly setup a relayer for a new user
(or someone who just wants to connect two testnets without taking hours).

## Automated Commands

These are the high-level entry-points that call a series of other commands.

### init

This is used to setup a new key and configuration file.

`ibc-setup init` will:

- initialize a home dir if it doesn't exist
- check for `registry.yaml` in the home dir and if missing, will download it from a default location

`ibc-setup init --src=XYZ --dest=ABC` will:

- initialize a home dir if it doesn't exist
- check for `registry.yaml` in the home dir and if missing, will download it from a default location
- generate a new mnemonic phrase
- initialize `app.yaml` in the home dir (if missing) with:

```yaml
src: XYZ
dest: ABC
mnemonic: "your codes here..."
```

It will then output the relayer's addresses on each chain on standard out and request the admin to fill those addresses with funds.

The idea is that you can initialize a home dir with a default registry file using `ibc-setup init`, make adjustments and then run the command again with `--src` and `--dest` flags to generate a configuration file (`app.yaml`).

### ics20

This requires `registry.yaml`, `app.yaml` and funded accounts on both sides. If either account is not funded,
it will print a clear error message on startup. It will accept two optional flags to specify the ports on
each side, but default to `transfer` if those are not present.

`ibc-setup ics20 [--src-port=transfer] [--dest-port=transfer]` will:

- ensure accounts have funds on both sides
- if `srcConnection` and `destConnection` are defined:
  - ensure the connections exist and do connect the two given chains
- else (you must define `srcConnection` and `destConnection` at the same time or none of them):
  - create a new client on both sides
  - create a new connection between these clients
- store the `srcConnection` and `destConnection` in `app.yaml`
- create a new unordered channel with version `ics20-1` between the two chains on the given connection and given port (default `transfer`)

When this is finished, there is an established connection for ics20 transfers. If you wish to establish multiple channels on
one connection, do not pass in `--connection` on the first call, but pass in the `connection_id` established by the first call
in all subsequent calls. They will share a connection/client and thus save in paying for future light client proofs.

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

For now, we only handle the case of 1 client : 1 connection. This is a nice simplification and
until there is a real need, allows us simpler tooling.

- `ibc-setup connect` - this connects to both chains from registry defined in `app.yaml` and creates a new client
  for the counterparty on each side. It then goes through the Connection handshake process. At the end,
  it returns the newly established `client_id` and `connection_id` to stdout as well as storing them in `app.yaml`

### Channel Setup

Once there is an established connection, we can create multiple channels here. This takes a little visibility,
so we provide some query commands as well.

- `ibc-setup ports --chain=ABC`
  - this takes one chain and lists all bound ports on the chain
- `ibc-setup channels --chain=XYZ [--port=transfer]`
  - this lists all channels on the given chain. You may focus on just one port if you wish to see just those channels. It shows all channels, both open, as well as channels in the handshaking process or closed ones (with a comment on non-open ones)
- `ibc-setup channel --src-connection=connection=3 --dest-connection=connection=3 --src-port=transfer --dest-port=vault [--ordered] --version=ics20-1`
  - this will before the channel handshake on an existing connection. It will first validate the connection is open and does connect the two chains we provided. It will start `OnChanInit` on the `src` chain using `src-port` and `version`.
    By default it makes unordered channels, add the `--ordered` flag to make them ordered.
  - after the init, it continues with `OnChanTry` on the `dest` flag with the `dest-port` and the same `version`. We can add support for different versions for both sides in the future when that case exists.
  - on success, it goes back to the `src` chain with `OnChanAck`
  - and finally on the `dest` chain with `OnChanConfirm`
  - once the channel is established, it is output to stdout

## Questions

Shall all the query commands (`balances`, `ports`, `channels`) be prefixed to separate them from the other (unprefixed)
commands that make state changes. `ibc-setup query ports`??
