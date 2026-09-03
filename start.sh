#!/usr/bin/env bash
# ==============================================================================
# SIH26162 — Interactive Service Launcher (Backend & Frontend)
# AI-Based Detection & Classification of Industrial Fires (NTRO)
# ==============================================================================

set -u

# ── Color Palettes ────────────────────────────────────────────────────────────
BOLD="\033[1m"
RESET="\033[0m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
BLUE="\033[34m"
MAGENTA="\033[35m"
DIM="\033[2m"

# ── Project Directory ─────────────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR" || exit 1

BACKEND_PORT=8000
FRONTEND_PORT=3000

BACKEND_PID=""
FRONTEND_PID=""

# ── Cleanup Handler ───────────────────────────────────────────────────────────
cleanup() {
  echo -e "\n${YELLOW}⏻ Shutting down services...${RESET}"
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo -e "  ${DIM}Stopping FastAPI backend (PID: $BACKEND_PID)...${RESET}"
    kill -TERM "$BACKEND_PID" 2>/dev/null || kill -9 "$BACKEND_PID" 2>/dev/null
  fi
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo -e "  ${DIM}Stopping Next.js frontend (PID: $FRONTEND_PID)...${RESET}"
    kill -TERM "$FRONTEND_PID" 2>/dev/null || kill -9 "$FRONTEND_PID" 2>/dev/null
  fi
  echo -e "${GREEN}✓ All services stopped cleanly.${RESET}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# ── Helper Utilities ──────────────────────────────────────────────────────────
detect_python() {
  if command -v python3 >/dev/null 2>&1; then
    echo "python3"
  elif command -v python >/dev/null 2>&1; then
    echo "python"
  else
    echo ""
  fi
}

detect_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    echo "pnpm"
  elif command -v npx >/dev/null 2>&1; then
    echo "npx pnpm"
  elif command -v npm >/dev/null 2>&1; then
    echo "npm"
  else
    echo ""
  fi
}

is_port_in_use() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    lsof -i :"$port" -sTCP:LISTEN -t >/dev/null 2>&1
  elif command -v netstat >/dev/null 2>&1; then
    netstat -tuln 2>/dev/null | grep -q ":$port "
  else
    # Python fallback check
    local py
    py=$(detect_python)
    if [ -n "$py" ]; then
      $py -c "import socket; s = socket.socket(); s.settimeout(0.5); exit(0 if s.connect_ex(('127.0.0.1', $port)) == 0 else 1)" 2>/dev/null
    else
      return 1
    fi
  fi
}

kill_port_process() {
  local port=$1
  echo -e "${YELLOW}  Freeing port $port...${RESET}"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "$port/tcp" >/dev/null 2>&1
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti :"$port")
    if [ -n "$pids" ]; then
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

print_header() {
  clear 2>/dev/null || true
  echo -e "${CYAN}${BOLD}"
  echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
  echo "║       🛰️   SIH26162 — THERMAL INTELLIGENCE MISSION CONTROL SYSTEM            ║"
  echo "║       Autonomous Detection & Classification of Industrial Thermal Hazards     ║"
  echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

check_dependencies() {
  local py
  py=$(detect_python)
  local pnpm_cmd
  pnpm_cmd=$(detect_pnpm)

  echo -e "${BOLD}Checking Environment Dependencies:${RESET}"
  
  if [ -n "$py" ]; then
    local py_ver
    py_ver=$($py --version 2>&1)
    echo -e "  ${GREEN}✓ Python:${RESET}    $py_ver ($py)"
  else
    echo -e "  ${RED}✗ Python 3 not found in PATH!${RESET}"
  fi

  if command -v node >/dev/null 2>&1; then
    local node_ver
    node_ver=$(node --version)
    echo -e "  ${GREEN}✓ Node.js:${RESET}   $node_ver"
  else
    echo -e "  ${RED}✗ Node.js not found in PATH!${RESET}"
  fi

  if [ -n "$pnpm_cmd" ]; then
    echo -e "  ${GREEN}✓ Package:${RESET}   $pnpm_cmd"
  else
    echo -e "  ${YELLOW}⚠ pnpm not detected, npm will be used as fallback${RESET}"
  fi

  echo ""
}

# ── Service Start Functions ───────────────────────────────────────────────────
start_backend() {
  local py
  py=$(detect_python)
  if [ -z "$py" ]; then
    echo -e "${RED}Error: Python not found. Please install Python 3.10+${RESET}"
    return 1
  fi

  if is_port_in_use $BACKEND_PORT; then
    echo -e "${YELLOW}Port $BACKEND_PORT is already in use.${RESET}"
    read -rp "Do you want to terminate the existing process on :$BACKEND_PORT? (y/N): " choice
    if [[ "$choice" =~ ^[Yy]$ ]]; then
      kill_port_process $BACKEND_PORT
      sleep 1
    fi
  fi

  echo -e "${CYAN}▶ Starting FastAPI Thermal Backend on port $BACKEND_PORT...${RESET}"
  $py -m uvicorn apps.api.main:app --host 0.0.0.0 --port $BACKEND_PORT &
  BACKEND_PID=$!

  # Wait for backend health
  echo -ne "  Connecting to API health probe"
  local attempts=0
  local ready=false
  while [ $attempts -lt 15 ]; do
    if is_port_in_use $BACKEND_PORT; then
      ready=true
      break
    fi
    echo -ne "."
    sleep 1
    attempts=$((attempts + 1))
  done
  echo ""

  if [ "$ready" = true ]; then
    echo -e "  ${GREEN}${BOLD}✓ FastAPI Backend online at:${RESET} ${CYAN}http://127.0.0.1:$BACKEND_PORT${RESET}"
    echo -e "  ${DIM}API Documentation:${RESET}         ${CYAN}http://127.0.0.1:$BACKEND_PORT/docs${RESET}"
  else
    echo -e "  ${YELLOW}⚠ Backend process started (PID: $BACKEND_PID) but probe pending.${RESET}"
  fi
}

start_frontend() {
  local pnpm_cmd
  pnpm_cmd=$(detect_pnpm)

  if is_port_in_use $FRONTEND_PORT; then
    echo -e "${YELLOW}Port $FRONTEND_PORT is already in use.${RESET}"
    read -rp "Do you want to terminate the existing process on :$FRONTEND_PORT? (y/N): " choice
    if [[ "$choice" =~ ^[Yy]$ ]]; then
      kill_port_process $FRONTEND_PORT
      sleep 1
    fi
  fi

  echo -e "${CYAN}▶ Starting Next.js Web Dashboard on port $FRONTEND_PORT...${RESET}"
  (
    cd "$ROOT_DIR/apps/web" || exit 1
    if [ -f "standalone-dev.js" ]; then
      node standalone-dev.js
    else
      $pnpm_cmd dev
    fi
  ) &
  FRONTEND_PID=$!

  # Wait for frontend health
  echo -ne "  Compiling Next.js dev artifacts"
  local attempts=0
  local ready=false
  while [ $attempts -lt 20 ]; do
    if is_port_in_use $FRONTEND_PORT; then
      ready=true
      break
    fi
    echo -ne "."
    sleep 1
    attempts=$((attempts + 1))
  done
  echo ""

  if [ "$ready" = true ]; then
    echo -e "  ${GREEN}${BOLD}✓ Mission Control Web GUI online at:${RESET} ${CYAN}${BOLD}http://localhost:$FRONTEND_PORT${RESET}"
    echo -e "  ${DIM}Live Tactical Map:${RESET}                   ${CYAN}http://localhost:$FRONTEND_PORT/map${RESET}"
  else
    echo -e "  ${YELLOW}⚠ Frontend compilation started (PID: $FRONTEND_PID).${RESET}"
  fi
}

run_diagnostics() {
  local py
  py=$(detect_python)
  echo -e "\n${BOLD}=== System Diagnostics & Health Check ===${RESET}"
  
  if is_port_in_use $BACKEND_PORT; then
    echo -e "  ${GREEN}✓ Backend ($BACKEND_PORT):${RESET} RUNNING"
    if [ -n "$py" ]; then
      $py -c "
import urllib.request, json
try:
    with urllib.request.urlopen('http://127.0.0.1:$BACKEND_PORT/api/v1/health', timeout=3) as r:
        d = json.loads(r.read())
        print(f'    • Status: {d.get(\"status\")}')
        print(f'    • Stored Events: {d.get(\"components\", {}).get(\"event_store\", {}).get(\"events_stored\", \"N/A\")}')
except Exception as e:
    print(f'    • Probe failed: {e}')
" 2>/dev/null
    fi
  else
    echo -e "  ${RED}✗ Backend ($BACKEND_PORT):${RESET} OFFLINE"
  fi

  if is_port_in_use $FRONTEND_PORT; then
    echo -e "  ${GREEN}✓ Frontend ($FRONTEND_PORT):${RESET} RUNNING (http://localhost:$FRONTEND_PORT)"
  else
    echo -e "  ${RED}✗ Frontend ($FRONTEND_PORT):${RESET} OFFLINE"
  fi
  echo ""
  read -rp "Press [Enter] to return to menu..." _
}

reseed_hotspots() {
  local py
  py=$(detect_python)
  echo -e "\n${CYAN}▶ Reseeding thermal hotspot events from sovereign India dataset...${RESET}"
  if [ -n "$py" ]; then
    $py -c "
import urllib.request, json
try:
    req = urllib.request.Request('http://127.0.0.1:$BACKEND_PORT/api/v1/events/reseed', method='POST')
    with urllib.request.urlopen(req, timeout=10) as r:
        d = json.loads(r.read())
        print('  ✓ Reseed successful:', d.get('message', 'Done'))
except Exception as e:
    print('  ✗ Reseed error (make sure backend is running):', e)
"
  fi
  echo ""
  read -rp "Press [Enter] to return to menu..." _
}

stop_all_services() {
  echo -e "\n${YELLOW}Stopping running services on ports $BACKEND_PORT and $FRONTEND_PORT...${RESET}"
  kill_port_process $BACKEND_PORT
  kill_port_process $FRONTEND_PORT
  BACKEND_PID=""
  FRONTEND_PID=""
  echo -e "${GREEN}✓ Ports cleared.${RESET}\n"
  sleep 1
}

# ── Main Interactive Menu ─────────────────────────────────────────────────────
main_menu() {
  while true; do
    print_header
    check_dependencies

    echo -e "${BOLD}Choose a launch option:${RESET}"
    echo -e "  ${CYAN}[1]${RESET} 🚀 ${BOLD}Start Full Stack${RESET}      (FastAPI Backend + Next.js Web GUI)"
    echo -e "  ${CYAN}[2]${RESET} ⚡ ${BOLD}Start Backend Only${RESET}    (FastAPI Ingestion & Swarm API on :8000)"
    echo -e "  ${CYAN}[3]${RESET} 🖥️  ${BOLD}Start Frontend Only${RESET}   (Next.js 16 Mission Control on :3000)"
    echo -e "  ${CYAN}[4]${RESET} 🧪 ${BOLD}Run Diagnostics${RESET}       (Check API health, ports & endpoints)"
    echo -e "  ${CYAN}[5]${RESET} 🔄 ${BOLD}Reseed Hotspots${RESET}       (Refresh Indian mainland thermal dataset)"
    echo -e "  ${CYAN}[6]${RESET} 🛑 ${BOLD}Stop All Services${RESET}     (Free ports 8000 & 3000)"
    echo -e "  ${RED}[0]${RESET} 🚪 ${BOLD}Exit${RESET}"
    echo ""
    read -rp "Select option [0-6]: " opt

    case "$opt" in
      1)
        print_header
        start_backend
        echo ""
        start_frontend
        echo -e "\n${GREEN}${BOLD}================================================================${RESET}"
        echo -e "${GREEN}${BOLD}  ✨ All Services Running! Press [Ctrl+C] to gracefully stop.    ${RESET}"
        echo -e "${GREEN}${BOLD}================================================================${RESET}"
        echo -e "  • Web GUI: ${CYAN}${BOLD}http://localhost:3000${RESET}"
        echo -e "  • Live Map: ${CYAN}http://localhost:3000/map${RESET}"
        echo -e "  • API Docs: ${CYAN}http://127.0.0.1:8000/docs${RESET}\n"
        wait
        ;;
      2)
        print_header
        start_backend
        echo -e "\n${GREEN}Backend running in foreground. Press [Ctrl+C] to return.${RESET}"
        wait "$BACKEND_PID" 2>/dev/null || true
        ;;
      3)
        print_header
        start_frontend
        echo -e "\n${GREEN}Frontend running in foreground. Press [Ctrl+C] to return.${RESET}"
        wait "$FRONTEND_PID" 2>/dev/null || true
        ;;
      4)
        run_diagnostics
        ;;
      5)
        reseed_hotspots
        ;;
      6)
        stop_all_services
        ;;
      0|q|Q)
        echo -e "\n${CYAN}Exiting. Have a great mission!${RESET}"
        exit 0
        ;;
      *)
        echo -e "\n${RED}Invalid selection. Please enter 0-6.${RESET}"
        sleep 1.5
        ;;
    esac
  done
}

main_menu
