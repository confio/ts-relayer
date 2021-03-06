#!/bin/sh
set -o errexit -o nounset
command -v shellcheck >/dev/null && shellcheck "$0"

PASSWORD=${PASSWORD:-1234567890}
CHAIN_ID=${CHAIN_ID:-gaia-testing}
MONIKER=${MONIKER:-gaia-moniker}

# The staking and the fee tokens. The supply of the staking token is low compared to the fee token (factor 100).
STAKE=${STAKE_TOKEN:-uatom}

# 1000 ATOM
START_BALANCE="1000000000$STAKE"

echo "Creating genesis ..."
gaiad init --chain-id "$CHAIN_ID" "$MONIKER"
sed -i "s/\"stake\"/\"$STAKE\"/" "$HOME"/.gaia/config/genesis.json # staking/governance token is hardcoded in config, change this
# this is essential for sub-1s block times (or header times go crazy)
sed -i 's/"time_iota_ms": "1000"/"time_iota_ms": "10"/' "$HOME"/.gaia/config/genesis.json

echo "Setting up validator ..."
if ! gaiad keys show validator 2>/dev/null; then
  echo "Validator does not yet exist. Creating it ..."
  (
    echo "$PASSWORD"
    echo "$PASSWORD"
  ) | gaiad keys add validator
fi
# hardcode the validator account for this instance
echo "$PASSWORD" | gaiad add-genesis-account validator "$START_BALANCE"

echo "Setting up accounts ..."
# (optionally) add a few more genesis accounts
for addr in "$@"; do
  echo "$addr"
  gaiad add-genesis-account "$addr" "$START_BALANCE"
done

echo "Creating genesis tx ..."
SELF_DELEGATION="3000000$STAKE" # 3 STAKE (leads to a voting power of 3)
(
  echo "$PASSWORD"
  echo "$PASSWORD"
  echo "$PASSWORD"
) | gaiad gentx validator "$SELF_DELEGATION" --offline --chain-id "$CHAIN_ID" --moniker="$MONIKER"
gaiad collect-gentxs
