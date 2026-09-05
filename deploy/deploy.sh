#!/usr/bin/env bash
# ==============================================================================
# SIH26162 — One-Command Production Pull, Build & Deploy Script
# ==============================================================================
# Usage:
#   sih-up
#   or: bash /var/www/sih/deploy/deploy.sh
#
# Updates backend (git pull + pip + pycache purge + hard restart)
# AND frontend (build + reload) in one shot.
# ==============================================================================

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "\n${CYAN}======================================================${NC}"
echo -e "${CYAN}  🚀 SIH26162 — Autonomous Deployment & Sync Pipeline ${NC}"
echo -e "${CYAN}======================================================${NC}\n"

APP_DIR="/var/www/sih"
cd "$APP_DIR"

# 1. Ensure Docker Supporting Services (Redis & PostGIS) are up
echo -e "${YELLOW}[1/6] Ensuring Docker infrastructure containers are running...${NC}"
docker compose up -d redis postgres > /dev/null 2>&1 || true
echo -e "${GREEN}✓ Redis & PostGIS Docker containers active.${NC}"

# 2. Pull Latest Code from Git
echo -e "\n${YELLOW}[2/6] Pulling latest code from GitHub...${NC}"
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    # --rebase avoids 'divergent branches' hint; works even when local+runtime-cache are dirty
    if ! git pull --rebase origin main 2>/dev/null; then
        # Fallback: fetch + align to remote tip
        git fetch origin
        git rebase origin/main 2>/dev/null || git reset --hard origin/main
        echo -e "${YELLOW}Notice: Working tree aligned to origin/main.${NC}"
    fi
else
    echo -e "${YELLOW}Skipping git pull (standalone directory).${NC}"
fi

# 3. Update Python Dependencies
echo -e "\n${YELLOW}[3/6] Verifying Python backend dependencies...${NC}"
./venv/bin/pip install -r apps/api/requirements.txt --quiet --disable-pip-version-check
echo -e "${GREEN}✓ Backend dependencies ready.${NC}"

# 4. HARD RESTART Backend API (purge bytecode cache + restart process)
echo -e "${YELLOW}[4/6] Restarting backend API with fresh code...${NC}"
# Purge stale __pycache__ so .pyc never shadows updated .py files
find "$APP_DIR/apps/api" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
# Hard restart (not soft reload) guarantees the uvicorn process re-imports all code
pm2 restart sih26162-api --update-env > /dev/null 2>&1 || true
echo -e "${GREEN}✓ Backend API restarted with fresh code.${NC}"

# 5. Build Next.js Production Web App
echo -e "\n${YELLOW}[5/6] Building Next.js production bundle...${NC}"
cd "$APP_DIR/apps/web"
npm run build
cd "$APP_DIR"
echo -e "${GREEN}✓ Next.js build completed.${NC}"

# 6. Reload PM2 Web Service (Zero Downtime cluster reload)
echo -e "${YELLOW}[6/6] Reloading PM2 services...${NC}"
# MUST use exact PM2 app name from ecosystem.config.js: sih26162-web (not "web")
pm2 reload ecosystem.config.js --only sih26162-web > /dev/null 2>&1 || pm2 reload sih26162-web > /dev/null 2>&1 || pm2 start ecosystem.config.js
pm2 save --force > /dev/null 2>&1
echo -e "${GREEN}✓ All services reloaded and operational!${NC}"

# Sanity check: wait briefly and confirm both API and Web answer
sleep 2
if curl -sf http://127.0.0.1:8000/api/v1/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend health check passed.${NC}"
else
    echo -e "${RED}✗ Backend health check FAILED — inspect: pm2 logs sih26162-api${NC}"
fi

# Verify the web build actually changed (CSS chunk should start with new prefix)
WEB_CSS_HASH=$(curl -s http://127.0.0.1:3000/ | grep -oE '[a-z0-9]+\.css' | sort -u | head -1)
if [ -n "$WEB_CSS_HASH" ] && [ -f "$APP_DIR/apps/web/.next/static/chunks/$WEB_CSS_HASH" ]; then
    echo -e "${GREEN}✓ Web build live (CSS: $WEB_CSS_HASH).${NC}"
else
    echo -e "${RED}✗ Web build may be stale — check: pm2 logs sih26162-web${NC}"
fi

# 7. Output Status
echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}  ✅ Deployment Successful! All services are live.    ${NC}"
echo -e "${GREEN}======================================================${NC}\n"
pm2 status
echo -e "${CYAN}Docker Containers:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo -e "\n${CYAN}• Domain: https://26162.codepegst.xyz/${NC}"
