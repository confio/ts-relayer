#!/bin/bash
set -o errexit -o nounset -o pipefail
command -v shellcheck >/dev/null && shellcheck "$0"

SCRIPT_DIR="$(realpath "$(dirname "$0")")"
# shellcheck source=./env
# shellcheck disable=SC1091
source "$SCRIPT_DIR"/env

rm -rf "$SCRIPT_DIR/template"
mkdir "$SCRIPT_DIR/template"

export CHAIN_ID=wasmd-1

# TODO: go back to just using ./setup_wasmd.sh and not mounting scripts dir
# once https://github.com/CosmWasm/wasmd/pull/453 is merged and in our CI image

# The usage of the accounts below is documented in README.md of this directory
docker run --rm \
  -e PASSWORD=my-secret-password \
  -e CHAIN_ID \
  --mount type=bind,source="$SCRIPT_DIR/template",target=/root \
  --mount type=bind,source="$SCRIPT_DIR/scripts/setup_wasmd.sh",target=/opt/setup_wasmd.sh \
  "$REPOSITORY:$VERSION" \
  /opt/setup_wasmd.sh \
  wasm14qemq0vw6y3gc3u3e0aty2e764u4gs5lndxgyk


# The ./template folder is created by the docker daemon's user (root on Linux, current user
# when using Docker Desktop on macOS), let's make it ours if needed
if [ ! -x "$SCRIPT_DIR/template/.wasmd/config/gentx" ]; then
  sudo chown -R "$(id -u):$(id -g)" "$SCRIPT_DIR/template"
fi

(
  cd "$SCRIPT_DIR"
  # so weird, but found I needed the -M flag after lots of debugging odd error messages
  # happening when redirecting stdout
  jq -S -M . < "template/.wasmd/config/genesis.json" > genesis.tmp
  mv genesis.tmp "template/.wasmd/config/genesis.json"

  # Custom settings in config.toml
  sed -i"" \
    -e 's/^cors_allowed_origins =.*$/cors_allowed_origins = ["*"]/' \
    -e 's/^timeout_propose =.*$/timeout_propose = "100ms"/' \
    -e 's/^timeout_propose_delta =.*$/timeout_propose_delta = "100ms"/' \
    -e 's/^timeout_prevote =.*$/timeout_prevote = "100ms"/' \
    -e 's/^timeout_prevote_delta =.*$/timeout_prevote_delta = "100ms"/' \
    -e 's/^timeout_precommit =.*$/timeout_precommit = "100ms"/' \
    -e 's/^timeout_precommit_delta =.*$/timeout_precommit_delta = "100ms"/' \
    -e 's/^timeout_commit =.*$/timeout_commit = "200ms"/' \
    "template/.wasmd/config/config.toml"

  # Custom settings app.toml
  sed -i"" \
    -e 's/^enable =.*$/enable = true/' \
    -e 's/^enabled-unsafe-cors =.*$/enabled-unsafe-cors = true/' \
    -e 's/^minimum-gas-prices = \".*\"/minimum-gas-prices = \"0.025ucosm\"/' \
    "template/.wasmd/config/app.toml"
)
