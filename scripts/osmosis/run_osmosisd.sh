#!/bin/bash
set -o errexit -o nounset -o pipefail
command -v shellcheck >/dev/null && shellcheck "$0"

# add debug info here
cp -R "/template/.osmosisd" /root
mkdir -p /root/log
osmosisd start --rpc.laddr tcp://0.0.0.0:26657 --trace
