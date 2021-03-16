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
  wasm1pkptre7fdkl6gfrzlesjjvhxhlc3r4gm32kke3 wasm10dyr9899g6t0pelew4nvf4j5c3jcgv0r5d3a5l wasm1xy4yqngt0nlkdcenxymg8tenrghmek4n3u2lwa wasm142u9fgcjdlycfcez3lw8x6x5h7rfjlnfaallkd wasm1hsm76p4ahyhl5yh3ve9ur49r5kemhp2r93f89d \
  wasm14qemq0vw6y3gc3u3e0aty2e764u4gs5lndxgyk wasm1hhg2rlu9jscacku2wwckws7932qqqu8xm5ca8y wasm1xv9tklw7d82sezh9haa573wufgy59vmwnxhnsl wasm17yg9mssjenmc3jkqth6ulcwj9cxujrxxg9nmzk wasm1f7j7ryulwjfe9ljplvhtcaxa6wqgula3nh873j \
  wasm1lvrwcvrqlc5ktzp2c4t22xgkx29q3y83426at5 wasm1vkv9sfwaak76weyamqx0flmng2vuquxqjq3flu wasm106jwym4s9aujcmes26myzzwqsccw09sd3nap5h wasm1c7wpeen2uv8thayf7g8q2rgpm29clj0dzlu7t9 wasm1mjxpv9ft30wer7ma7kwfxhm42l379xuttrjcl3 \
  wasm1cjsxept9rkggzxztslae9ndgpdyt240842kpxh \
  wasm17d0jcz59jf68g52vq38tuuncmwwjk42us8fnse \
  wasm1p6xs63q4g7np99ttv5nd3yzkt8n4qxa45jkgsk wasm1meeu3jl268txxytwmmrsljk8rawh6n2mhwp76p wasm1cak6lnpfxs035xd88sq8e4zujsm8g2g953hfan wasm1x3x8kyypx8z6q7fx3gw65x29mhl5gg8qtf4xkg wasm18c27m2rj4lg74md03ujralvt562c097nd7scqw wasm1q2y53e6x7s5mlddtd2qkcjr3nwr4dszvs4js2q wasm1paa2gstlk7c98n27dw2g6tp6fyqvf32m3x04t6 wasm1rvxjd8k6xvssz2eerfzemvat35pttfgrsz43tx wasm12zejt8d9xl70jd2333p4p265m2nr9h8g6pgmly wasm1exctm2036jtwyc9v3ftqfzmgnv9tdhj2sskt4u wasm1f3pws3ztnp3s4nn5zxqdrl9vlqv5avkq3rjfe7

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
