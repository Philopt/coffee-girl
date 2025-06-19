#!/usr/bin/env sh
# Verify Node.js version 22.x
set -e
REQUIRED="22.x"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Please install a version $REQUIRED." >&2
  exit 1
fi

raw="$(node --version)"
version=${raw#v}
major=${version%%.*}

# exit if major not in range
if [ "$major" -ne 22 ]; then
  echo "Unsupported Node.js version $raw. Required $REQUIRED." >&2
  exit 1
fi
