#!/usr/bin/env bash
# ── OpenPhD YOLO Installer ──
# curl -fsSL https://raw.githubusercontent.com/GindaChen/openphd/main/install.sh | bash
set -euo pipefail

REPO_URL="https://github.com/GindaChen/openphd.git"
DIR_NAME="openphd"
MIN_NODE=18

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()  { printf "${CYAN}▸${NC} %s\n" "$*"; }
ok()    { printf "${GREEN}✔${NC} %s\n" "$*"; }
fail()  { printf "${RED}✖ %s${NC}\n" "$*" >&2; exit 1; }

# ── Preflight ──
info "Checking prerequisites…"

command -v git  >/dev/null 2>&1 || fail "git is required.  Install it: https://git-scm.com"
command -v node >/dev/null 2>&1 || fail "node is required. Install it: https://nodejs.org (v${MIN_NODE}+)"
command -v npm  >/dev/null 2>&1 || fail "npm is required.  It ships with Node.js."

NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt "$MIN_NODE" ]; then
  fail "Node.js v${MIN_NODE}+ required (you have v$(node -v | tr -d 'v')). Upgrade: https://nodejs.org"
fi
ok "git, node v$(node -v | tr -d 'v'), npm v$(npm -v)"

# ── Clone ──
if [ -d "$DIR_NAME/.git" ]; then
  info "Directory '${DIR_NAME}' already exists — pulling latest…"
  git -C "$DIR_NAME" pull --ff-only
else
  info "Cloning ${REPO_URL}…"
  git clone "$REPO_URL" "$DIR_NAME"
fi

cd "$DIR_NAME"

# ── Install deps ──
info "Installing backend dependencies…"
(cd services/kanban && npm install --silent)
ok "Backend ready"

info "Installing frontend dependencies…"
(cd frontend && npm install --silent)
ok "Frontend ready"

# ── Banner ──
printf "\n"
printf "${BOLD}${GREEN}┌──────────────────────────────────────────┐${NC}\n"
printf "${BOLD}${GREEN}│       OpenPhD installed successfully!     │${NC}\n"
printf "${BOLD}${GREEN}└──────────────────────────────────────────┘${NC}\n"
printf "\n"
printf "  ${BOLD}Start it:${NC}\n"
printf "    cd %s/frontend && npm run dev\n\n" "$DIR_NAME"
printf "  ${BOLD}Then open:${NC}  http://localhost:5173\n\n"
printf "  ${BOLD}Optional:${NC}\n"
printf "    ANTHROPIC_API_KEY=sk-ant-… npm run dev   # enable AI agent\n"
printf "    GITHUB_TOKEN=ghp_…        npm run dev   # enable GitHub sync\n"
printf "\n"
