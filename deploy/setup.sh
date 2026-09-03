#!/bin/bash
# ==============================================================================
# SIH26162 — Automated EC2 Setup Script (Ubuntu 24.04 LTS)
# ==============================================================================
set -e

echo "=== [1/6] Updating Ubuntu system packages ==="
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl wget git build-essential nginx python3-pip python3-venv python3-dev

echo "=== [2/6] Installing Node.js 20.x & pnpm ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo corepack enable
sudo npm install -g pnpm pm2

echo "Node version: $(node -v)"
echo "pnpm version: $(pnpm -v)"
echo "Python version: $(python3 --version)"

echo "=== [3/6] Setting up 2GB Swap (stability safeguard) ==="
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "=== [4/6] Installing Python virtual environment & dependencies ==="
cd ~/SIH26162
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r apps/api/requirements.txt

echo "=== [5/6] Installing Node dependencies & building Next.js ==="
pnpm install
cd apps/web
pnpm run build
cd ~/SIH26162

echo "=== [6/6] Configuring Nginx Reverse Proxy ==="
sudo cp deploy/nginx.conf /etc/nginx/sites-available/sih26162
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/sih26162 /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "=== Starting Apps with PM2 Process Manager ==="
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu | sudo tee /tmp/pm2-startup.sh
sudo chmod +x /tmp/pm2-startup.sh
sudo /tmp/pm2-startup.sh || true

echo "=============================================================================="
echo "🎉 DEPLOYMENT COMPLETE! Open your browser at: http://$(curl -s ifconfig.me)"
echo "=============================================================================="
