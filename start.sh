#!/bin/sh
# Start the production server with .env bootstrap
exec node "$(dirname "$0")/scripts/start.mjs"
