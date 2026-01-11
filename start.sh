#!/bin/bash
# ============================================================
#  KING•VPN — start.sh (DTunnel)
#  ✅ Lee PORT y dominio desde .env (sin hardcode)
#  ✅ Arranca / reinicia por PM2 de forma limpia
#  ✅ Opcional: build + prisma db push (con flags)
#  ✅ NGINX: test + reload seguro
# ============================================================

set -euo pipefail

# --------------------------
# UI
# --------------------------
RED="\033[0;31m"; GRN="\033[0;32m"; YEL="\033[1;33m"; CYA="\033[0;36m"; WHT="\033[1;37m"; RST="\033[0m"
step(){ echo -e "${CYA}➜${RST} ${WHT}$1${RST}"; }
ok(){   echo -e "${GRN}✔${RST} ${WHT}$1${RST}"; }
warn(){ echo -e "${YEL}⚠${RST} ${WHT}$1${RST}"; }
die(){  echo -e "${RED}✖${RST} ${WHT}$1${RST}"; exit 1; }

# --------------------------
# Config
# --------------------------
PROJECT_DIR="/root/DTunnel"
APP_NAME="kingvpn-panel"   # <- el nombre real que querés ver en pm2
ENV_FILE="$PROJECT_DIR/.env"

# Flags:
#   ./start.sh            -> solo inicia/reinicia
#   ./start.sh --build    -> npm run build antes
#   ./start.sh --dbpush   -> prisma db push antes
#   ./start.sh --fresh    -> limpia logs de pm2 + builds temporales
DO_BUILD=0
DO_DBPUSH=0
DO_FRESH=0

for arg in "${@:-}"; do
  case "$arg" in
    --build) DO_BUILD=1 ;;
    --dbpush) DO_DBPUSH=1 ;;
    --fresh) DO_FRESH=1 ;;
    -h|--help)
      cat <<'EOF'
Uso:
  ./start.sh [--build] [--dbpush] [--fresh]

Opciones:
  --build   Ejecuta: npm run build
  --dbpush  Ejecuta: npx prisma db push
  --fresh   Limpia logs PM2 + temporales del proyecto
EOF
      exit 0
    ;;
  esac
done

# --------------------------
# Validaciones
# --------------------------
[ "$(id -u)" -eq 0 ] || die "Ejecutalo como root."
[ -d "$PROJECT_DIR" ] || die "No existe $PROJECT_DIR"
cd "$PROJECT_DIR"

command -v pm2 >/dev/null 2>&1 || die "PM2 no está instalado (npm i -g pm2)"
command -v nginx >/dev/null 2>&1 || warn "NGINX no está instalado (se omite reload)"
command -v node >/dev/null 2>&1 || die "Node no está instalado"

[ -f "$ENV_FILE" ] || die "No existe $ENV_FILE (crealo con el install.sh)"

# --------------------------
# Cargar .env sin romper el sistema
# --------------------------
step "Cargando variables desde .env..."
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

PORT="${PORT:-}"
APP_BASE_URL="${APP_BASE_URL:-}"
FRONTEND_RETURN_URL="${FRONTEND_RETURN_URL:-}"

[ -n "${PORT// }" ] || die "PORT no está definido en .env"
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  die "PORT inválido en .env: $PORT"
fi

# URL mostrada (solo para el mensaje final)
PUBLIC_URL="$APP_BASE_URL"
if [ -z "${PUBLIC_URL// }" ]; then
  PUBLIC_URL="$FRONTEND_RETURN_URL"
fi
PUBLIC_URL="${PUBLIC_URL%/}"

ok "PORT=$PORT"
[ -n "${PUBLIC_URL// }" ] && ok "PUBLIC_URL=$PUBLIC_URL" || warn "APP_BASE_URL no definido (solo visual)"

# --------------------------
# Fresh cleanup (opcional)
# --------------------------
if [ "$DO_FRESH" -eq 1 ]; then
  step "Limpieza fresh: logs PM2 + temporales..."
  pm2 flush >/dev/null 2>&1 || true
  rm -f "$PROJECT_DIR/tsconfig.tsbuildinfo" 2>/dev/null || true
  find "$PROJECT_DIR" -type f \( -name "*.tsbuildinfo" -o -name "*.tmp" \) -delete 2>/dev/null || true
  ok "Fresh cleanup listo"
fi

# --------------------------
# Prisma (opcional)
# --------------------------
if [ "$DO_DBPUSH" -eq 1 ]; then
  [ -f "$PROJECT_DIR/package.json" ] || die "No existe package.json"
  step "Prisma: db push (NO borra DB)..."
  npx prisma db push
  ok "Prisma OK"
fi

# --------------------------
# Build (opcional)
# --------------------------
if [ "$DO_BUILD" -eq 1 ]; then
  [ -f "$PROJECT_DIR/package.json" ] || die "No existe package.json"
  step "Build: npm run build..."
  npm run build
  ok "Build OK"
fi

# --------------------------
# Iniciar / reiniciar con PM2
# --------------------------
step "Iniciando/reiniciando PM2 app: $APP_NAME..."

# Si existe ecosystem.config.js, mejor usarlo.
if [ -f "$PROJECT_DIR/ecosystem.config.js" ]; then
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    step "PM2: restart con --update-env (ecosystem.config.js)"
    pm2 restart "$APP_NAME" --update-env
  else
    step "PM2: start ecosystem.config.js con --update-env"
    pm2 start "$PROJECT_DIR/ecosystem.config.js" --only "$APP_NAME" --update-env || pm2 start "$PROJECT_DIR/ecosystem.config.js" --update-env
  fi
else
  # fallback: pm2 start npm -- start
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    step "PM2: restart (npm start) con --update-env"
    pm2 restart "$APP_NAME" --update-env
  else
    step "PM2: start npm -- start"
    pm2 start npm --name "$APP_NAME" -- start
  fi
fi

pm2 save >/dev/null 2>&1 || true
ok "PM2 OK"

# --------------------------
# NGINX reload seguro
# --------------------------
if command -v nginx >/dev/null 2>&1; then
  step "NGINX: test + reload..."
  nginx -t
  systemctl reload nginx
  ok "NGINX OK"
fi

# --------------------------
# Info final
# --------------------------
echo
echo "========================================"
echo "      KING•VPN PANEL LISTO"
echo "========================================"
echo "App PM2 : $APP_NAME"
echo "Port   : $PORT"
if [ -n "${PUBLIC_URL// }" ]; then
  echo "URL    : $PUBLIC_URL"
else
  echo "URL    : (no definido en .env)"
fi
echo "Logs   : pm2 logs $APP_NAME --lines 100"
echo "Estado : pm2 status"
echo "========================================"
