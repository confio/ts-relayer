# IBC Relayer

The IBC Relayer is a simple binary with one command: `start`. When run, it will read configuration
data and then seek to continually relay all packets over all channels on it's pre-configured connection.

The most interesting elements of the Relayer is [configuring it's logging](./logging.md) for easy debugging,
as well as [checking metrics](./metrics.md) to set up alerts or Grafana dashboards.

`ibc-relayer start --src=ABC --dest=XYZ --connection=connection-3 --key-file=relayer.key`

This process will do the following:

## Connect

- For chain in [`ABC`, `XYZ`]:
  - Derive key/address
  - Connect to rpc port
  - Verify chain_id matches registry
  - Ensure that relayer address has some funds (or error early)
  - Search for `$connection`
  - Get the client for that connection
    - Ensure it is tendermint client and active
    - Ensure the remote chain_id in client matches the other chain's chain_id
    - Record the last update time/height
  - List all bound ports
  - List all open channels on this connection
  - Query all unrelayed packets
    - If expired, add to _Timeout Packets_
    - Else, add to _Pending Packets_

## Loop

(via poll or subscriptions)

- Monitor the current block height/time
  - If too far from last client update -> _Update Client_
- Listen for all `send_packet` events and add to _Pending Packets_
- Listen for all `acknowledge_packet` events and add to _Pending Packets_

### UpdateClient

Copy commit from chain B and submit to chain A

TODO: details

### PendingPackets

Simple:

- _UpdateClient_
- Submit N transactions for the N PendingPackets
  - Ensure packets from the same ordered channel are submitted sequentially, don't send if one missing

Batching (saves gas):

- Wait until X time has passed or N packets are pending
- Then do "simple" relay

### Timeout Packets

TODO - how to find/detect
