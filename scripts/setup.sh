#!/usr/bin/env sh
# Install project dependencies
set -e
if command -v npm >/dev/null 2>&1; then
  npm ci
else
  echo "npm not found. Please install Node.js and npm." >&2
  exit 1
fi
