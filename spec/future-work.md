# Future Work

These are various ideas that will not be available in `v1` but seem interesting in terms of a
longer-term road map of the relayer. There is no guarantee any of these will be implemented, but
if there is interest in an area, then please do get involved and push to make this happen.

## Filtering Packets

Do not relay all packets for the connection. Filter on port, channel, signer, etc.
Allow the relayer operator to add their custom business logic here. We will first work
on a clean interface so that someone could fork (or better import) the code and add
a function to filter the packets (yes/no) on arbitrary criteria.

Once common criteria are well defined via usage, we can add config file options to support
the most common use-cases "out of the box".

Filtering packets will require very solid handling of timeouts, as well as consideration
of how to apply this on ordered channels. As a first step, we can either approve or deny
all packets on an ordered channel. If there are three packets: A, B, and C and the
filter rejects B, do we block C until B times out, and hope that C is not timed out by the
time we are ready to relay it?

## Handle IBC Upgrades

Currently no code is planned for this. The simplest solution should be to shutdown a relayer
and start up a new one after the upgrade, which will find the correct state. We can add code
to detect this case and auto-upgrade.

This will be hard to test and some months til actually used, so this goes into "later"

## Light Client Verification

If we connect to untrusted rpc nodes, they could give us garbage header commits, which will be
rejected by the receiving chain and cost us gas. The simple solution is just to connect to
a trusted full node on each side (you probably want your own node for the relayer to ensure availability anyway).
We could add some proof checking inside the relayer for the UpgradeClient section, but it
has limited utility.

## High Availability

It is nice to have a fall-over relayer ready when one crashed or runs out of funds.
It is very expensive to have two run in parallel, as you are paying 2x the gas for
every packet only to have one fail.

We propose to build a setup such that a standby relayer can detect when the primary has
failed and automatically start up to take over packet sending. The primary must also
check if anyone else is running upon a restart.

_Strawman idea_

A backup relayer could simply scan for any client updates for the given connection/client,
and if it sees nothing for a given period (2000 blocks?), it would start up. Upon startup,
it would check if any client updates have happened in this window. If so, it checks if they
came from this relayer (signed by this address). If another relayer has been active in that
window, it starts up in standby mode. Otherwise, it starts up as an active relayer.

## HSM Integration

Relayers must have access to a hot wallet with tokens to pay the gas fees. As IBC transactions
are relatively expensive and this will make quite a few, there may be a reasonable amount
of tokens in this hot wallet, which would make it a target for thieves.

One solution is to use a HSM, like the validators or peggy, which would only sign IBC transactions.
Even if someone got root on the machine, they could not get the private key, nor force the process
to send tokens to their account.

## Multiple Relayer Keys

Allow the relayer to have multiple accounts under it's control, which it can switch when one runs low,
or simply to allow sending more messages concurrently without worrying about sequence numbers.

We could also support fee grants here (SDK v0.42+), so we could have eg. 10 signing keys that all pull
their fees from one address.
