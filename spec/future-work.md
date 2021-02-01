# Future Work

These are various ideas that will not be available in `v1` but seem interesting in terms of a
longer-term road map of the relayer. There is no guarantee any of these will be implemented, but
if there is interest in an area, then please do get involved and push to make this happen.

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
