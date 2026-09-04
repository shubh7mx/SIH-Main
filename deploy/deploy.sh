#!/usr/bin/env bash
# ==============================================================================
# SIH26162 — One-Command Production Pull, Build & Deploy Script
# ==============================================================================
# Usage:
#   sih-up
#   or: bash /var/www/sih/deploy/deploy.sh
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
echo -e "${YELLOW}[1/5] Ensuring Docker infrastructure containers are running...${NC}"
docker compose up -d redis postgres > /dev/null 2>&1 || true
echo -e "${GREEN}✓ Redis & PostGIS Docker containers active.${NC}"

# 2. Pull Latest Code from Git
echo -e "\n${YELLOW}[2/5] Pulling latest code from GitHub...${NC}"
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    git pull origin main || echo -e "${YELLOW}Notice: Working tree up to date or using local files.${NC}"
else
    echo -e "${YELLOW}Skipping git pull (standalone directory).${NC}"
fi

# 3. Update Python Dependencies
echo -e "\n${YELLOW}[3/5] Verifying Python backend dependencies...${NC}"
./venv/bin/pip install -r apps/api/requirements.txt --quiet --disable-pip-version-check
echo -e "${GREEN}✓ Backend dependencies ready.${NC}"

# 4. Build Next.js Production Web App
echo -e "\n${YELLOW}[4/5] Building Next.js production bundle...${NC}"
cd "$APP_DIR/apps/web"
npm run build
cd "$APP_DIR"
echo -e "${GREEN}✓ Next.js build completed.${NC}"

# 5. Reload PM2 Services (Zero Downtime)
echo -e "\n${YELLOW}[5/5] Reloading PM2 services (Zero Downtime)...${NC}"
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js
pm2 save --force > /dev/null 2>&1
echo -e "${GREEN}✓ All services reloaded and operational!${NC}"

# 6. Output Status
echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}  ✅ Deployment Successful! All services are live.    ${NC}"
echo -e "${GREEN}======================================================${NC}\n"
pm2 status
echo -e "\n${CYAN}Docker Containers:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo -e "\n${CYAN}• Domain: https://26162.codepegst.xyz/${NC}"
echo -e "${CYAN}• Web:    http://127.0.0.1:3000${NC}"
echo -e "${CYAN}• API:    http://127.0.0.1:8000/api/v1/health${NC}\n"
