#!/bin/sh
set -o errexit -o nounset -o pipefail
command -v shellcheck >/dev/null && shellcheck "$0"

# add debug info here
cp -R "/template/.gaia" /root
mkdir -p /root/log
gaiad start --rpc.laddr tcp://0.0.0.0:26657 --trace
