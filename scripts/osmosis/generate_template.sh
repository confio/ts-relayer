#!/bin/bash
set -o errexit -o nounset -o pipefail
command -v shellcheck >/dev/null && shellcheck "$0"

SCRIPT_DIR="$(realpath "$(dirname "$0")")"
echo $SCRIPT_DIR
# shellcheck source=./env
# shellcheck disable=SC1091
source "$SCRIPT_DIR"/env

mkdir -p "$SCRIPT_DIR"/template

echo "Trying docker $REPOSITORY:$VERSION"

# The usage of the accounts below is documented in README.md of this directory
docker run --rm \
  --user=root \
  -e TRANSFER_PORT=transfer \
  --mount type=bind,source="$SCRIPT_DIR/template",target=/root \
  "$REPOSITORY:$VERSION" \
  /opt/setup.sh \
  osmo1lvrwcvrqlc5ktzp2c4t22xgkx29q3y83hdcc5d

sudo chmod -R g+rwx template/.osmosisd/
sudo chmod -R a+rx template/.osmosisd/

# The ./template folder is created by the docker daemon's user (root on Linux, current user
# when using Docker Desktop on macOS), let's make it ours if needed
if [ ! -x "$SCRIPT_DIR/template/.osmosisd/config/gentx" ]; then
  sudo chown -R "$(id -u):$(id -g)" "$SCRIPT_DIR/template"
fi
