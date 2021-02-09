#!/bin/bash
set -o errexit -o nounset -o pipefail
command -v shellcheck >/dev/null && shellcheck "$0"

SCRIPT_DIR="$(realpath "$(dirname "$0")")"
# shellcheck source=./env
# shellcheck disable=SC1091
source "$SCRIPT_DIR"/env

ROOT="$SCRIPT_DIR/../.."
ROOT_PROTO_DIR="$ROOT/proto/cosmos/cosmos-sdk"
COSMOS_PROTO_DIR="$ROOT_PROTO_DIR/proto"
THIRD_PARTY_PROTO_DIR="$ROOT_PROTO_DIR/third_party/proto"
OUT_DIR="$ROOT/src/codec/"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

protoc \
  --plugin="$(yarn bin protoc-gen-ts_proto)" \
  --ts_proto_out="$OUT_DIR" \
  --proto_path="$COSMOS_PROTO_DIR" \
  --proto_path="$THIRD_PARTY_PROTO_DIR" \
  --ts_proto_opt="esModuleInterop=true,forceLong=long,useOptionals=true" \
  "$COSMOS_PROTO_DIR/ibc/applications/transfer/v1/transfer.proto" \
  "$COSMOS_PROTO_DIR/ibc/applications/transfer/v1/genesis.proto" \
  "$COSMOS_PROTO_DIR/ibc/applications/transfer/v1/query.proto" \
  "$COSMOS_PROTO_DIR/ibc/applications/transfer/v1/tx.proto" \
  "$COSMOS_PROTO_DIR/ibc/core/channel/v1/channel.proto" \
  "$COSMOS_PROTO_DIR/ibc/core/channel/v1/genesis.proto" \
  "$COSMOS_PROTO_DIR/ibc/core/channel/v1/query.proto" \
  "$COSMOS_PROTO_DIR/ibc/core/channel/v1/tx.proto" \
  "$COSMOS_PROTO_DIR/ibc/core/client/v1/client.proto" \
  "$COSMOS_PROTO_DIR/ibc/core/client/v1/genesis.proto" \
  "$COSMOS_PROTO_DIR/ibc/core/client/v1/query.proto" \
  "$COSMOS_PROTO_DIR/ibc/core/client/v1/tx.proto" \
  "$COSMOS_PROTO_DIR/ibc/core/commitment/v1/commitment.proto" \
  "$COSMOS_PROTO_DIR/ibc/core/connection/v1/connection.proto" \
  "$COSMOS_PROTO_DIR/ibc/core/connection/v1/genesis.proto" \
  "$COSMOS_PROTO_DIR/ibc/core/connection/v1/query.proto" \
  "$COSMOS_PROTO_DIR/ibc/core/connection/v1/tx.proto" \
  "$COSMOS_PROTO_DIR/ibc/lightclients/localhost/v1/localhost.proto" \
  "$COSMOS_PROTO_DIR/ibc/lightclients/solomachine/v1/solomachine.proto" \
  "$COSMOS_PROTO_DIR/ibc/lightclients/tendermint/v1/tendermint.proto" \
  "$THIRD_PARTY_PROTO_DIR/confio/proofs.proto" \
  "$THIRD_PARTY_PROTO_DIR/tendermint/abci/types.proto" \
  "$THIRD_PARTY_PROTO_DIR/tendermint/crypto/keys.proto" \
  "$THIRD_PARTY_PROTO_DIR/tendermint/crypto/proof.proto" \
  "$THIRD_PARTY_PROTO_DIR/tendermint/libs/bits/types.proto" \
  "$THIRD_PARTY_PROTO_DIR/tendermint/types/params.proto" \
  "$THIRD_PARTY_PROTO_DIR/tendermint/types/types.proto" \
  "$THIRD_PARTY_PROTO_DIR/tendermint/types/validator.proto" \
  "$THIRD_PARTY_PROTO_DIR/tendermint/version/types.proto"

# Remove unnecessary codec files
rm -rf \
  src/codec/cosmos_proto/ \
  src/codec/gogoproto/ \
  src/codec/google/api/ \
  src/codec/google/protobuf/descriptor.ts
