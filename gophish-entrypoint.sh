#!/bin/sh
# config.json needs to live on the /data volume (not baked into /app) so the
# web console can edit it — but seeding it there can't rely on Docker's
# "copy image content into a fresh empty volume" behavior, since that only
# fires the first time a volume is created; anyone upgrading an existing
# gophish-data volume from before this file existed would never get it.
set -e
if [ ! -f /data/config.json ]; then
  cp /app/config.json.default /data/config.json
fi
exec /app/gophish --config /data/config.json
