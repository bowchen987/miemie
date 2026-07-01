#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BUNDLED_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"

if command -v node >/dev/null 2>&1; then
  NODE_BIN=node
elif [ -x "$BUNDLED_NODE" ]; then
  NODE_BIN="$BUNDLED_NODE"
else
  echo "Node.js was not found. Install Node.js 20+ or run this from Codex with bundled dependencies." >&2
  exit 1
fi

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8787}"

cd "$ROOT_DIR/web"
exec "$NODE_BIN" server/index.mjs
