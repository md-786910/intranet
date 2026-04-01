#!/bin/sh
set -e

echo "[entrypoint] Installing dependencies..."
npm install

echo "[entrypoint] Starting application..."
exec npx nodemon \
  --legacy-watch \
  --polling-interval 1000 \
  --watch src \
  --watch package.json \
  --watch .env \
  --ext js,json,env \
  -x "npm install --prefer-offline && node src/server.js"
