#!/bin/bash
set -o errexit -o nounset -o pipefail
command -v shellcheck >/dev/null && shellcheck "$0"

SCRIPT_DIR="$(realpath "$(dirname "$0")")"
echo $SCRIPT_DIR
# shellcheck source=./env
# shellcheck disable=SC1091
source "$SCRIPT_DIR"/env

rm -rf "$SCRIPT_DIR/template"
mkdir "$SCRIPT_DIR/template"
cp setup.sh "$SCRIPT_DIR/template/"
chmod +x "$SCRIPT_DIR/template/setup.sh"
cp run_osmosisd.sh "$SCRIPT_DIR/template/"
chmod +x "$SCRIPT_DIR/template/run_osmosisd.sh"

# The usage of the accounts below is documented in README.md of this directory
docker run --rm \
  --user=root \
  -e PASSWORD=my-secret-password \
  -e STAKE_TOKEN=uosmo \
  -e TRANSFER_PORT=transfer \
  --mount type=bind,source="$SCRIPT_DIR/template",target=/root \
  --entrypoint /root/setup.sh \
  "$REPOSITORY:$VERSION" \
  osmo1pkptre7fdkl6gfrzlesjjvhxhlc3r4gmnd5nxg osmo10dyr9899g6t0pelew4nvf4j5c3jcgv0rk2nctx osmo1xy4yqngt0nlkdcenxymg8tenrghmek4nnmg63y osmo142u9fgcjdlycfcez3lw8x6x5h7rfjlnfl6a6f5 osmo1hsm76p4ahyhl5yh3ve9ur49r5kemhp2r8ktz65 \
  osmo14qemq0vw6y3gc3u3e0aty2e764u4gs5l32ydm0 osmo1hhg2rlu9jscacku2wwckws7932qqqu8xen6cca osmo1xv9tklw7d82sezh9haa573wufgy59vmw3p4k0x osmo17yg9mssjenmc3jkqth6ulcwj9cxujrxx2z37a0 osmo1f7j7ryulwjfe9ljplvhtcaxa6wqgula33s9mwt \
  osmo1lvrwcvrqlc5ktzp2c4t22xgkx29q3y83hdcc5d osmo1vkv9sfwaak76weyamqx0flmng2vuquxqs8nvq9 osmo106jwym4s9aujcmes26myzzwqsccw09sdn5lytw osmo1c7wpeen2uv8thayf7g8q2rgpm29clj0dqc7m5u osmo1mjxpv9ft30wer7ma7kwfxhm42l379xutfysaqg \
  osmo1cjsxept9rkggzxztslae9ndgpdyt2408hd5yew \
  osmo17d0jcz59jf68g52vq38tuuncmwwjk42ujqtk0q

sudo chmod -R g+rwx template/.osmosisd/
sudo chmod -R a+rx template/.osmosisd/

# The ./template folder is created by the docker daemon's user (root on Linux, current user
# when using Docker Desktop on macOS), let's make it ours if needed
if [ ! -x "$SCRIPT_DIR/template/.osmosisd/config/gentx" ]; then
  sudo chown -R "$(id -u):$(id -g)" "$SCRIPT_DIR/template"
fi

(
  cd "$SCRIPT_DIR"
  # so weird, but found I needed the -M flag after lots of debugging odd error messages
  # happening when redirecting stdout
  jq -S -M . < "template/.osmosisd/config/genesis.json" > genesis.tmp
  mv genesis.tmp "template/.osmosisd/config/genesis.json"
  chmod a+rx template/.osmosisd/config/genesis.json

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
    "template/.osmosisd/config/config.toml"

  # Custom settings app.toml
  sed -i"" \
    -e 's/^enable =.*$/enable = true/' \
    -e 's/^enabled-unsafe-cors =.*$/enabled-unsafe-cors = true/' \
    -e 's/^minimum-gas-prices = \".*\"/minimum-gas-prices = \"0uosmo\"/' \
    "template/.osmosisd/config/app.toml"
)
