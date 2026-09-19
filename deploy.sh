#!/usr/bin/env bash
# ==============================================================================
# Script: deploy.sh
# One-command quick update and redeploy script for server
# ==============================================================================

set -e

echo "🚀 [1/4] Checking for code updates (git pull)..."
if [ -d .git ]; then
  git pull || echo "Git pull skipped or failed, continuing with local files..."
fi

echo "📦 [2/4] Installing / Updating dependencies..."
npm install

echo "🔨 [3/4] Building production assets (Vite + esbuild server.cjs)..."
npm run build

echo "🔄 [4/4] Reloading PM2 process..."
if command -v pm2 >/dev/null 2>&1; then
  # Automatically resolve conflicts if both ghasil and laundry-app exist
  if pm2 describe ghasil >/dev/null 2>&1 && pm2 describe laundry-app >/dev/null 2>&1; then
    echo "⚠️ Detected duplicate 'laundry-app' process while 'ghasil' is active. Removing duplicate..."
    pm2 stop laundry-app || true
    pm2 delete laundry-app || true
  fi

  if pm2 describe ghasil >/dev/null 2>&1; then
    pm2 restart ghasil --update-env
  elif pm2 describe laundry-app >/dev/null 2>&1; then
    pm2 restart laundry-app --update-env
  elif [ -f ecosystem.config.cjs ]; then
    pm2 start ecosystem.config.cjs
  else
    pm2 start dist/server.cjs --name "ghasil"
  fi
  pm2 save
  echo "✅ Application reloaded successfully!"
else
  echo "⚠️ PM2 not found. You can run 'npm start' manually."
fi
