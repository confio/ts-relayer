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

Every command that submits a transaction to a blockchain (that is, almost all of them) require key material
to run. We pass that in via a mnemonic phrase, and then derive all private keys via the chain-specific
hd paths in the `registry.yaml`.

There are two ways to pass in the mnemonic, either directly, or referencing a file that contains such a phrase.
One of these command line flags (or env var, or config file value) should be present:

- `--mnemonic` - this must contain a BIP39 mnemonic phrase
- `--key-file` - this must contain a path to a file which contains only a BIP39 mnemonic phrase
- `--interactive` or `-i` - must be run in a tty by an operator. Will read the mnemonic from stdin.
  For those who never want this to hit disk.

If multiple flags are present, precedence is `interactive`, `mnemonic`, then `key-file`.
However, the standard lookup order still applies, so `--key-file` will be used over `RELAYER_MNEMONIC` variable.
