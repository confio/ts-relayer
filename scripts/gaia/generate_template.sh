#!/bin/bash
set -o errexit -o nounset -o pipefail
command -v shellcheck >/dev/null && shellcheck "$0"

SCRIPT_DIR="$(realpath "$(dirname "$0")")"
# shellcheck source=./env
# shellcheck disable=SC1091
source "$SCRIPT_DIR"/env

mkdir -p "$SCRIPT_DIR"/template

# The usage of the accounts below is documented in README.md of this directory
docker run --rm \
  --user=root \
  -e TRANSFER_PORT=custom \
  --mount type=bind,source="$SCRIPT_DIR/template",target=/root \
  "$REPOSITORY:$VERSION" \
  /opt/setup.sh \
  cosmos1pkptre7fdkl6gfrzlesjjvhxhlc3r4gmmk8rs6 \
  cosmos14qemq0vw6y3gc3u3e0aty2e764u4gs5le3hada

sudo chmod -R g+rwx template/.gaia/
sudo chmod -R a+rx template/.gaia/

# The ./template folder is created by the docker daemon's user (root on Linux, current user
# when using Docker Desktop on macOS), let's make it ours if needed
if [ ! -x "$SCRIPT_DIR/template/.gaia/config/gentx" ]; then
  sudo chown -R "$(id -u):$(id -g)" "$SCRIPT_DIR/template"
fi
