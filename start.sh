#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#   KING•VPN — START PRO (DTunnel)
#   - Idempotente
#   - Diagnóstico claro (causa + evidencia + fix)
#   - No mata procesos por defecto
# ============================================================

PROJECT_DIR="/root/DTunnel"
APP_NAME="${APP_NAME:-kingvpn-panel}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"

FORCE_KILL=false
SKIP_BUILD=false
SKIP_PRISMA=false
NO_NGINX=false

for arg in "${@:-}"; do
  case "$arg" in
    --force) FORCE_KILL=true ;;
    --skip-build) SKIP_BUILD=true ;;
    --skip-prisma) SKIP_PRISMA=true ;;
    --no-nginx) NO_NGINX=true ;;
    *) ;;
  esac
done

# --------------------------
# UI
# --------------------------
RST="\033[0m"
B="\033[1m"
DIM="\033[2m"
RED="\033[0;31m"
GRN="\033[0;32m"
YEL="\033[1;33m"
CYA="\033[0;36m"
MAG="\033[0;35m"
WHT="\033[1;37m"

line() { echo -e "${MAG}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"; }
title(){ line; echo -e "${MAG}${B}KING•VPN${RST} ${WHT}${B}$1${RST}"; line; }
step() { echo -e "${CYA}➜${RST} ${WHT}$*${RST}"; }
ok()   { echo -e "${GRN}✔${RST} ${WHT}$*${RST}"; }
warn() { echo -e "${YEL}⚠${RST} ${WHT}$*${RST}"; }
err()  { echo -e "${RED}✖${RST} ${WHT}${B}$*${RST}"; }

die() { err "$1"; exit "${2:-1}"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Falta comando requerido: $1" 20
}

# --------------------------
# Checks básicos
# --------------------------
require_cmd node
require_cmd npm
require_cmd pm2
require_cmd curl

[ -d "$PROJECT_DIR" ] || die "No existe PROJECT_DIR: $PROJECT_DIR" 21
cd "$PROJECT_DIR"

[ -f ".env" ] || die "No existe .env en $PROJECT_DIR (corré install.sh primero)." 22

# Carga .env (no imprime)
set -a
# shellcheck disable=SC1091
source ".env"
set +a

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-8080}" # respeta .env si existe
PORT="$PORT"

title "Start PRO — DTunnel"
echo -e "${DIM}Proyecto:${RST} $PROJECT_DIR"
echo -e "${DIM}App:${RST} $APP_NAME"
echo -e "${DIM}NODE_ENV:${RST} $NODE_ENV  ${DIM}PORT:${RST} $PORT"
echo

# --------------------------
# Utils
# --------------------------
has_script() {
  node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts['$1']?0:1)" >/dev/null 2>&1
}

find_entry() {
  local entry=""
  local candidates=(
    "build/index.js"
    "build/server.js"
    "dist/index.js"
    "dist/server.js"
    "dist/main.js"
    "server.js"
    "index.js"
  )
  for f in "${candidates[@]}"; do
    if [ -f "$f" ]; then entry="$f"; break; fi
  done
  echo "$entry"
}

port_owner() {
  # Devuelve: "PID CMD"
  local p
  p="$(lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n1 || true)"
  if [ -z "$p" ]; then
    echo ""
    return 0
  fi
  echo "$p $(ps -p "$p" -o cmd= 2>/dev/null | sed 's/[[:space:]]\+/ /g' || true)"
}

pm2_has_app() {
  pm2 jlist | grep -q "\"name\":\"$APP_NAME\""
}

pm2_app_pid() {
  pm2 pid "$APP_NAME" 2>/dev/null | head -n1 | tr -d '\r' || true
}

# --------------------------
# node_modules
# --------------------------
if [ ! -d "node_modules" ]; then
  step "node_modules no existe → npm install"
  npm install
  ok "npm install OK"
else
  ok "node_modules OK"
fi

# --------------------------
# Prisma
# --------------------------
if [ "$SKIP_PRISMA" = false ] && [ -f "prisma/schema.prisma" ]; then
  step "Prisma → npx prisma db push"
  if npx prisma db push >/dev/null 2>&1; then
    ok "Prisma OK"
  else
    err "Prisma falló"
    echo -e "${DIM}Fix:${RST} ejecutá: npx prisma db push (ver salida completa)"
    exit 30
  fi
else
  warn "Prisma omitido (no encontrado o --skip-prisma)"
fi

# --------------------------
# Build
# --------------------------
ENTRY_BEFORE="$(find_entry)"

if [ "$SKIP_BUILD" = false ] && has_script build; then
  if [ -z "$ENTRY_BEFORE" ]; then
    step "Build faltante → npm run build"
    if npm run build; then
      ok "Build OK"
    else
      err "Build falló"
      echo -e "${DIM}Causa:${RST} TypeScript/tsc error"
      echo -e "${DIM}Fix:${RST} revisá salida de 'npm run build'"
      exit 31
    fi
  else
    ok "Build ya existe (${ENTRY_BEFORE})"
  fi
else
  warn "Build omitido (no hay script build o --skip-build)"
fi

ENTRY="$(find_entry)"

if [ -z "$ENTRY" ] && ! has_script start && ! has_script "start:prod"; then
  die "No encontré entrypoint (build/dist/index.js) ni scripts start/start:prod en package.json" 32
fi

# --------------------------
# Puerto ocupado (detallado y con causa)
# --------------------------
OWNER="$(port_owner || true)"
if [ -n "$OWNER" ]; then
  OWNER_PID="$(echo "$OWNER" | awk '{print $1}')"
  OWNER_CMD="$(echo "$OWNER" | cut -d' ' -f2-)"
  err "Puerto ocupado: ${PORT}"
  echo -e "${DIM}Causa:${RST} Ya hay un proceso escuchando en 0.0.0.0:${PORT}"
  echo -e "${DIM}Evidencia:${RST} PID=${OWNER_PID} CMD=${OWNER_CMD}"

  # si es nuestra app por PM2, esto es normal
  PM2PID="$(pm2_app_pid)"
  if [ -n "$PM2PID" ] && [ "$PM2PID" = "$OWNER_PID" ]; then
    ok "El puerto lo ocupa $APP_NAME (PM2) → OK"
  else
    echo -e "${DIM}Fix:${RST} Si es duplicado, borrá el duplicado o cambiá PORT."
    echo -e "  - pm2 delete panelweb   ${DIM}(si panelweb es el duplicado)${RST}"
    echo -e "  - o export PORT=8081 y reiniciá el proceso duplicado"
    if [ "$FORCE_KILL" = true ] && echo "$OWNER_CMD" | grep -q "$PROJECT_DIR"; then
      warn "--force activo: mato el PID $OWNER_PID (pertenece a $PROJECT_DIR)"
      kill -9 "$OWNER_PID" >/dev/null 2>&1 || true
      ok "Proceso eliminado (force)"
    else
      echo
      warn "No continúo para evitar EADDRINUSE. (Usá --force SOLO si sabés que es duplicado.)"
      exit 40
    fi
  fi
fi

# --------------------------
# PM2 start / restart
# --------------------------
if pm2_has_app; then
  step "PM2: restart $APP_NAME"
  pm2 restart "$APP_NAME" --update-env >/dev/null
  ok "PM2 restart OK"
else
  step "PM2: start $APP_NAME"

  if [ -n "$ENTRY" ]; then
    pm2 start "$ENTRY" --name "$APP_NAME" --time --update-env >/dev/null
  else
    if has_script "start:prod"; then
      pm2 start npm --name "$APP_NAME" --time --update-env -- run start:prod >/dev/null
    else
      pm2 start npm --name "$APP_NAME" --time --update-env -- run start >/dev/null
    fi
  fi
  ok "PM2 start OK"
fi

pm2 save >/dev/null 2>&1 || true

# Startup (no falla si ya está)
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# --------------------------
# Nginx
# --------------------------
if [ "$NO_NGINX" = false ] && command -v nginx >/dev/null 2>&1; then
  step "Nginx: test + restart"
  if nginx -t >/dev/null 2>&1; then
    systemctl restart nginx >/dev/null 2>&1 || true
    ok "Nginx OK"
  else
    err "Nginx config inválida"
    echo -e "${DIM}Fix:${RST} nginx -t  (y corregí el conf)"
    exit 50
  fi
else
  warn "Nginx omitido (--no-nginx o no instalado)"
fi

# --------------------------
# Healthcheck
# --------------------------
step "Healthcheck: http://${HOST}:${PORT}/"
HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" "http://${HOST}:${PORT}/" || true)"

if [[ "$HTTP_CODE" =~ ^(200|301|302|404)$ ]]; then
  ok "Panel responde (HTTP $HTTP_CODE)"
else
  err "Panel no responde bien"
  echo -e "${DIM}Causa:${RST} HTTP $HTTP_CODE"
  echo -e "${DIM}Fix:${RST} Mirá logs: pm2 logs $APP_NAME --lines 200"
  exit 60
fi

echo
ok "Listo."
echo -e "${DIM}Estado:${RST} pm2 status"
echo -e "${DIM}Logs:${RST}   pm2 logs $APP_NAME --lines 200"
