#!/bin/bash
set -o errexit -o nounset -o pipefail
command -v shellcheck > /dev/null && shellcheck "$0"

if [ $# -ne 1 ]; then
  echo "Usage: ./download_releases.sh RELEASE_TAG"
  exit 1
fi

# eg. v0.13.1
tag="$1"

for contract in cw20_base cw20_ics20; do
  url="https://github.com/CosmWasm/cosmwasm-plus/releases/download/${tag}/${contract}.wasm"
  echo "Downloading $url ..."
  wget -O "${contract}.wasm" "$url"
done

rm -f version.txt
echo "$tag" >version.txt
