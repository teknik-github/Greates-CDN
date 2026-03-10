#!/bin/sh
# Load .env file and start the production server
set -a
. "$(dirname "$0")/.env"
set +a
exec node "$(dirname "$0")/.output/server/index.mjs"
