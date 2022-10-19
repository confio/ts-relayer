---
"@confio/relayer": minor
---

Fix event parsing in cases where more than one IBC packet is emitted in a transaction.
Removed the "No message.sender nor message.signer" warning and the unused field `PacketWithMetadata.sender`.
