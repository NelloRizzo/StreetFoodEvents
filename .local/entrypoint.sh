#!/usr/bin/env bash
set -e

# Init single-node replica set for MongoDB (required by mongoose transactions)
mongod --replSet rs0 --bind_ip 0.0.0.0 --port 27017 --dbpath /data/db --fork --logpath /var/log/mongod.log

# Wait for mongod to be up
until mongosh --quiet --eval "db.runCommand({ping:1}).ok" 2>/dev/null | grep -q 1; do
  echo "Waiting for MongoDB...";
  sleep 1;
done

# Initiate replica set (idempotent)
mongosh --quiet --eval "
  const ok = db.runCommand({ hello: 1 });
  if (ok.setName !== 'rs0') {
    try { rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] }); } catch(e) {}
  }
" >/dev/null 2>&1 || true

# Wait for PRIMARY
until mongosh --quiet --eval "db.runCommand({hello:1}).isWritablePrimary" 2>/dev/null | grep -q true; do
  echo "Waiting for PRIMARY...";
  sleep 1;
done

echo "MongoDB replica set rs0 is PRIMARY"

# Seed the sandbox data
cd /app/backend-local
if [ -n "$SEED" ] && [ "$SEED" = "1" ]; then
  echo "Seeding database..."
  npx tsx src/seed.ts || echo "[seed] warning: seed failed"
fi

# Start the API server
echo "Starting local API on port 4000..."
exec npx tsx src/server.ts
