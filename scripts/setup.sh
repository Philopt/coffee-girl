#!/usr/bin/env sh
# Install project dependencies
set -e

# Ensure supported Node.js version
DIR="$(cd "$(dirname "$0")" && pwd)"
node "$DIR/check-node-version.mjs"

if command -v npm >/dev/null 2>&1; then
  npm ci
else
  echo "npm not found. Please install Node.js and npm." >&2
  exit 1
fi
