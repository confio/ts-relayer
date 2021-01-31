# Key Management

We assume that the computer running the relayer is well secured, and further that the relayer
has access to only a moderate amount of funds, say less than $1000. To simplify the situation,
we provide the relayer with an unencrypted mnemonic phrase at startup, which is used to generate
the keys and addresses for all chains it connects to.

Note that two relayers _may_ safely share the same mnemonic phrase _only if_ they point to different
chains. eg. one is A-B, the other is C-D. If they both had a chain in common, they would share an
address and cause all kinds of issue with sequence numbers when trying to send packets in parallel.
In general, it is good practice to provide each relayer instance with it's own mnemonic phrase.

## Configuration

There are multiple ways to pass this in, as [described in configuration](./config.md). We illustrate
them in order of precidence:

`--key-file=relayer1.key` you can pass a file as a CLI flag. The file should contain only a BIP39 mnemonic and nothing else

`RELAYER_MNEMONIC="apple travel fun ..."` you can pass the mnemonic directly as an env variable, for example, set in a service.conf file.

`RELAYER_KEY_FILE=/etc/secret/relayer2.key` you can pass a key file in as an environmental variable, like above

Default: if nothing is set, look for `relayer.key` in the home directory, which should contain a BIP39 mnemonic. Again, this
is only suitable for single-relayer machine setups.

## Commands

List some commands to work with relayer keys:

- `key generate` - generate a new mnemonic, either writing to a file or stdout. Does not require an exisiting mnemonic flag (as above)
- `key list` - given a mnemonic and the `registry.conf` file, prints out the relayer's address on all chains listed
  in the registry. This can be used to send it tokens to prepare it for running.
