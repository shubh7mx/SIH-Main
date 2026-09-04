#!/usr/bin/env bash
set -e
cd /var/www/sih
echo "[$(date)] Pulling latest code..."
git pull origin main 2>/dev/null || true
echo "[$(date)] Updating Python dependencies..."
./venv/bin/pip install -r apps/api/requirements.txt --quiet
echo "[$(date)] Building Next.js..."
cd /var/www/sih/apps/web
npm run build
cd /var/www/sih
echo "[$(date)] Reloading PM2 services zero-downtime..."
pm2 reload all
echo "[$(date)] Deployment sync complete!"
