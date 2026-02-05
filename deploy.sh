#!/usr/bin/env bash
set -e  # stop on first error

APP_DIR="~/Desktop/apps/slacksupport"   # change this
SERVICE="slacksupport"

cd "$APP_DIR"

echo "📥 Pulling latest code..."
git pull origin main

echo "🧬 Generating Prisma client & building..."
npx prisma generate
npm run build

echo "🔄 Reloading systemd..."
sudo systemctl daemon-reload

echo "🚀 Restarting service..."
sudo systemctl restart "$SERVICE"

echo "📜 Following logs..."
journalctl -u "$SERVICE" -f
