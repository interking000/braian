#!/usr/bin/env bash
# ============================================================
#   KING•VPN — INSTALL.SH (DTunnel)  ✅ PRO + BLINDADO
#   - Ejecutar:  chmod +x install.sh && ./install.sh
#   - Se corre DENTRO del repo /root/DTunnel (post-clone)
#
#   PIDE SOLO:
#     1) HOST (dominio)
#     2) PUERTO (interno)
#     3) TOKEN MERCADO PAGO
#     4) PRECIO PLAN (ARS)
#     5) NOMBRE QUE APARECE EN MP
#
#   HACE AUTOMÁTICO:
#     - Instala dependencias (idempotente)
#     - Crea/actualiza .env (con DB ABSOLUTA /root/DTunnel/prisma/database.db)
#     - Prisma db push + generate (BLINDADO)
#     - Instala libs: mercadopago, sharp
#     - Build
#     - NGINX + SSL autofirmado (host elegido)
#     - Levanta con PM2 si existe ecosystem.config.js
#     - Reporte final (DB + tablas)
# ============================================================

set -euo pipefail

# --------------------------
# COLORES / ESTILO
# --------------------------
RED="\033[0;31m"
GRN="\033[0;32m"
YEL="\033[1;33m"
BLU="\033[0;34m"
CYA="\033[0;36m"
MAG="\033[0;35m"
WHT="\033[1;37m"
DIM="\033[2m"
RST="\033[0m"

LINE="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
BOX_TOP="┏${LINE}┓"
BOX_BOT="┗${LINE}┛"
BOX_MID="┃"

title () {
  echo -e "${MAG}${BOX_TOP}${RST}"
  printf "${MAG}${BOX_MID}${RST} ${WHT}%-56s${MAG}${BOX_MID}${RST}\n" "$1"
  echo -e "${MAG}${BOX_BOT}${RST}"
}
step () { echo -e "${CYA}➜${RST} ${WHT}$1${RST}"; }
ok ()   { echo -e "${GRN}✔${RST} ${WHT}$1${RST}"; }
warn () { echo -e "${YEL}⚠${RST} ${WHT}$1${RST}"; }
die ()  { echo -e "${RED}✖${RST} ${WHT}$1${RST}"; exit 1; }

need_root () { [ "$(id -u)" -eq 0 ] || die "Ejecutá como root (sudo -i)"; }

ask_required () {
  local prompt="$1"
  local var=""
  while true; do
    read -r -p "➜ $prompt: " var
    if [[ -n "${var// }" ]]; then echo "$var"; return 0; fi
    echo -e "${YEL}⚠ Este valor es obligatorio${RST}"
  done
}

ask_port () {
  local p
  while true; do
    p="$(ask_required "Puerto interno del panel (1-65535)")"
    if [[ "$p" =~ ^[0-9]+$ ]] && [ "$p" -ge 1 ] && [ "$p" -le 65535 ]; then
      echo "$p"; return 0
    fi
    echo -e "${YEL}⚠ Puerto inválido (1-65535)${RST}"
  done
}

sanitize_domain () {
  local d="$1"
  d="${d#http://}"; d="${d#https://}"; d="${d%%/*}"
  echo "$d"
}

ask_domain () {
  local d
  while true; do
    d="$(ask_required "HOST / dominio del panel (ej: panel.tudominio.com)")"
    d="$(sanitize_domain "$d")"
    if [[ "$d" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
      echo "$d"; return 0
    fi
    echo -e "${YEL}⚠ Dominio inválido${RST}"
  done
}

ask_price () {
  local p
  while true; do
    p="$(ask_required "Precio del plan (ARS) para probar (ej: 100)")"
    if [[ "$p" =~ ^[0-9]+$ ]] && [ "$p" -ge 1 ] && [ "$p" -le 999999999 ]; then
      echo "$p"; return 0
    fi
    echo -e "${YEL}⚠ Precio inválido${RST}"
  done
}

# --------------------------
# PATHS FIJOS
# --------------------------
PROJECT_DIR="/root/DTunnel"
ENV_FILE="$PROJECT_DIR/.env"
NGINX_DIR="$PROJECT_DIR/nginx"
NGINX_CONF="/etc/nginx/sites-available/dtunnel.conf"
DB_DIR="$PROJECT_DIR/prisma"
DB_FILE="$DB_DIR/database.db"

# --------------------------
# START
# --------------------------
need_root
clear || true
title "KING•VPN — Instalador DTunnel (PRO + BLINDADO)"
echo -e "${DIM}No depende de dónde lo ejecutes. Arregla DB y deja todo listo.${RST}"
echo

# Siempre ubicarse en el proyecto
cd "$PROJECT_DIR" 2>/dev/null || die "No existe $PROJECT_DIR. Cloná el repo ahí y reintentá."
[ -f "$PROJECT_DIR/package.json" ] || die "No existe package.json en $PROJECT_DIR"
[ -f "$PROJECT_DIR/prisma/schema.prisma" ] || die "No existe prisma/schema.prisma (revisá tu repo)"

mkdir -p "$NGINX_DIR" "$DB_DIR"

title "CONFIGURACIÓN (solo 5 datos)"

PANEL_HOST="$(ask_domain)"
PANEL_PORT="$(ask_port)"
MP_ACCESS_TOKEN="$(ask_required "TOKEN MercadoPago (APP_USR-...)" )"
PLAN_PRICE_ARS="$(ask_price)"
MP_STORE_NAME="$(ask_required "Nombre que se muestra en MercadoPago (ej: KING•VPN)" )"

echo
ok "HOST:  $PANEL_HOST"
ok "PORT:  $PANEL_PORT"
ok "MP_TOKEN: (cargado)"
ok "PLAN_PRICE_ARS: $PLAN_PRICE_ARS"
ok "MP_STORE_NAME: $MP_STORE_NAME"

# --------------------------
# DEPENDENCIAS SISTEMA (idempotente)
# --------------------------
title "DEPENDENCIAS DEL SISTEMA"

step "Actualizando APT..."
apt update -y
apt upgrade -y

step "Instalando paquetes base..."
apt install -y \
  curl build-essential openssl git unzip zip ca-certificates software-properties-common \
  nginx ufw sqlite3 wget

# Node 18
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE '^v18\.'; then
  step "Instalando Node.js 18..."
  apt remove -y nodejs libnode-dev node-typescript >/dev/null 2>&1 || true
  apt autoremove -y || true
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
else
  ok "Node.js OK: $(node -v)"
fi

# PM2
if ! command -v pm2 >/dev/null 2>&1; then
  step "Instalando PM2..."
  npm install -g pm2
else
  ok "PM2 OK: $(pm2 -v)"
fi

# TypeScript
if ! command -v tsc >/dev/null 2>&1; then
  step "Instalando TypeScript..."
  npm install -g typescript
else
  ok "TypeScript OK: $(tsc -v)"
fi

# Java + apktool + apksigner (full)
if ! command -v java >/dev/null 2>&1; then
  step "Instalando OpenJDK 11..."
  apt install -y openjdk-11-jdk
else
  ok "Java OK"
fi

if ! command -v apktool >/dev/null 2>&1; then
  step "Instalando apktool..."
  apt install -y apktool || true
fi

if ! command -v apksigner >/dev/null 2>&1; then
  step "Instalando apksigner..."
  apt install -y apksigner || true
fi

# apktool bin + jar (sin pisar)
if [ ! -f /usr/local/bin/apktool ]; then
  step "Descargando apktool (bin)..."
  wget -q -O /usr/local/bin/apktool https://raw.githubusercontent.com/iBotPeaches/Apktool/master/scripts/linux/apktool
  chmod +x /usr/local/bin/apktool
else
  ok "apktool (bin) ya existe"
fi

if [ ! -f /usr/local/bin/apktool.jar ]; then
  step "Descargando apktool.jar..."
  wget -q -O /usr/local/bin/apktool.jar https://bitbucket.org/iBotPeaches/apktool/downloads/apktool_2.9.3.jar
else
  ok "apktool.jar ya existe"
fi

# build-tools opcional
apt install -y android-sdk-build-tools || warn "android-sdk-build-tools no disponible (se omite)"

ok "Dependencias sistema OK"

# --------------------------
# DEPENDENCIAS PROYECTO (npm)
# --------------------------
title "DEPENDENCIAS DEL PROYECTO"

cd "$PROJECT_DIR"

step "npm install (proyecto)..."
npm install

# asegurar libs que pediste (no rompe si ya están)
step "Instalando libs extra (mercadopago, sharp)..."
npm i mercadopago sharp >/dev/null 2>&1 || npm install mercadopago sharp

ok "Node deps OK"

# --------------------------
# .ENV (PRO + COMPLETO)
# --------------------------
title "CONFIGURANDO .ENV (PRO)"

CSRF_SECRET="$(openssl rand -hex 16)"
JWT_SECRET_KEY="$(openssl rand -hex 32)"
JWT_SECRET_REFRESH="$(openssl rand -hex 32)"

cat > "$ENV_FILE" <<EOF
# ===============================
# KING•VPN — DTunnel (.env)
# ===============================

# Servidor
PORT=$PANEL_PORT
NODE_ENV=production

# Prisma SQLite (RUTA ABSOLUTA BLINDADA)
DATABASE_URL="file:$DB_FILE"

# Seguridad
CSRF_SECRET=$CSRF_SECRET
JWT_SECRET_KEY=$JWT_SECRET_KEY
JWT_SECRET_REFRESH=$JWT_SECRET_REFRESH

# MercadoPago
MP_ACCESS_TOKEN=$MP_ACCESS_TOKEN
MP_STORE_NAME="$MP_STORE_NAME"

# Panel public
APP_BASE_URL="https://$PANEL_HOST"
FRONTEND_RETURN_URL="https://$PANEL_HOST"
EOF

ok ".env OK → $ENV_FILE"
ok "DATABASE_URL → file:$DB_FILE"

# --------------------------
# PRISMA + DATABASE (BLINDADO)
# --------------------------
title "PRISMA + DATABASE (BLINDADO)"

step "Inicializando base de datos Prisma (ruta fija)"

# 1) Garantizar directorio correcto
cd "$PROJECT_DIR"

# 2) Crear carpeta DB
mkdir -p "$DB_DIR"

# 3) Correr prisma desde ROOT, schema fijo
step "Prisma db push"
npx prisma db push --schema "$PROJECT_DIR/prisma/schema.prisma"

step "Prisma generate"
npx prisma generate --schema "$PROJECT_DIR/prisma/schema.prisma"

# 4) Si Prisma creó mal (prisma/prisma), arreglar solo
if [ -f "$PROJECT_DIR/prisma/prisma/database.db" ]; then
  warn "DB creada en ruta incorrecta (prisma/prisma). Corrigiendo..."
  mv -f "$PROJECT_DIR/prisma/prisma/database.db" "$DB_FILE"
  rmdir "$PROJECT_DIR/prisma/prisma" 2>/dev/null || true
fi

# 5) Validación final DB
if [ ! -s "$DB_FILE" ]; then
  die "La DB no se creó correctamente. Esperado: $DB_FILE"
fi

ok "DB OK → $DB_FILE ($(stat -c%s "$DB_FILE") bytes)"

# --------------------------
# SEED PLAN (SQLITE) + VALIDACIÓN TABLAS
# --------------------------
title "SEED + CHECK DB"

# Crear/actualizar plan_1m (según tu schema, tabla: plans)
step "Creando/actualizando plan_1m (precio ARS $PLAN_PRICE_ARS)..."
sqlite3 "$DB_FILE" "
INSERT INTO plans (code, name, months, price_ars, is_active, updated_at)
VALUES ('plan_1m', 'Acceso mensual $MP_STORE_NAME', 1, $PLAN_PRICE_ARS, 1, CURRENT_TIMESTAMP)
ON CONFLICT(code) DO UPDATE SET
  name=excluded.name,
  months=excluded.months,
  price_ars=excluded.price_ars,
  is_active=excluded.is_active,
  updated_at=CURRENT_TIMESTAMP;
" || die "No pude insertar/actualizar plan_1m. ¿Existe tabla plans? Revisá migrations/schema."

ok "Plan OK"

step "Mostrando tablas principales..."
sqlite3 "$DB_FILE" ".tables" | tr -s ' ' | sed 's/^/• /'

step "Chequeo rápido (counts):"
echo "• users:          $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "N/A")"
echo "• cdn:            $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM cdn;" 2>/dev/null || echo "N/A")"
echo "• categories:     $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM categories;" 2>/dev/null || echo "N/A")"
echo "• app_configs:    $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM app_configs;" 2>/dev/null || echo "N/A")"
echo "• app_texts:      $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM app_texts;" 2>/dev/null || echo "N/A")"
echo "• app_layouts:    $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM app_layouts;" 2>/dev/null || echo "N/A")"
echo "• payments:       $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM payments;" 2>/dev/null || echo "N/A")"
echo "• access_events:  $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM access_events;" 2>/dev/null || echo "N/A")"

ok "DB y tablas OK"

# --------------------------
# BUILD
# --------------------------
title "BUILD"

step "npm run build"
npm run build

ok "Build OK"

# --------------------------
# SSL + NGINX
# --------------------------
title "SSL + NGINX"

# SSL autofirmado (si no existe)
if [ ! -f "$NGINX_DIR/fullchain.pem" ] || [ ! -f "$NGINX_DIR/privkey.pem" ]; then
  step "Generando SSL autofirmado para $PANEL_HOST..."
  openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "$NGINX_DIR/privkey.pem" \
    -out "$NGINX_DIR/fullchain.pem" \
    -subj "/C=AR/ST=BuenosAires/O=KINGVPN/CN=$PANEL_HOST"
  ok "SSL OK"
else
  ok "SSL ya existe"
fi

step "Escribiendo config NGINX..."
cat > "$NGINX_CONF" <<EOF
server {
  listen 80;
  server_name $PANEL_HOST;
  return 301 https://\$host\$request_uri;
}

server {
  listen 443 ssl;
  server_name $PANEL_HOST;

  ssl_certificate     $NGINX_DIR/fullchain.pem;
  ssl_certificate_key $NGINX_DIR/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:$PANEL_PORT;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
EOF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/dtunnel.conf
[ -e /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default || true

step "Probando NGINX..."
nginx -t

step "Reiniciando NGINX..."
systemctl restart nginx
systemctl enable nginx >/dev/null 2>&1 || true
ok "NGINX OK"

# --------------------------
# PM2 START
# --------------------------
title "PM2"

cd "$PROJECT_DIR"
if [ -f "$PROJECT_DIR/ecosystem.config.js" ]; then
  step "Iniciando con PM2 (ecosystem.config.js)..."
  pm2 start "$PROJECT_DIR/ecosystem.config.js" --update-env || pm2 restart DTunnel --update-env || true
  pm2 save || true
  ok "PM2 OK"
else
  warn "No existe ecosystem.config.js. Iniciá tu app manual (ej: pm2 start build/index.js --name DTunnel)"
fi

# --------------------------
# FINAL
# --------------------------
title "FINALIZADO (KING•VPN)"

echo -e "${BOX_MID} ${GRN}✔${RST} Proyecto:         ${WHT}$PROJECT_DIR${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Host:             ${WHT}$PANEL_HOST${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Puerto interno:   ${WHT}$PANEL_PORT${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} .env:             ${WHT}$ENV_FILE${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} DB (blindada):    ${WHT}$DB_FILE${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Plan (ARS):       ${WHT}$PLAN_PRICE_ARS${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} MP nombre:        ${WHT}$MP_STORE_NAME${RST}"
echo -e "${BOX_MID} ${CYA}➜${RST} Logs:             ${WHT}pm2 logs DTunnel --lines 200${RST}"
echo -e "${MAG}${BOX_BOT}${RST}"
echo
ok "Listo. Si algo falla, el script corta y te dice exactamente qué."
