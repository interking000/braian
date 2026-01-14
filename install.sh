#!/bin/bash
set -euo pipefail

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

need_root () {
  if [ "$(id -u)" -ne 0 ]; then
    die "Este script debe ejecutarse como root"
  fi
}

ask_required () {
  local prompt="$1"
  local var=""
  while true; do
    read -r -p "➜ $prompt: " var
    if [[ -n "${var// }" ]]; then
      echo "$var"
      return 0
    fi
    echo -e "${YEL}⚠ Este valor es obligatorio${RST}"
  done
}

ask_port () {
  local p=""
  while true; do
    p="$(ask_required "Puerto interno del panel (ej 8080)")"
    if [[ "$p" =~ ^[0-9]+$ ]] && [ "$p" -ge 1 ] && [ "$p" -le 65535 ]; then
      echo "$p"
      return 0
    fi
    echo -e "${YEL}⚠ Puerto inválido (1-65535)${RST}"
  done
}

sanitize_domain () {
  local d="$1"
  d="${d#http://}"
  d="${d#https://}"
  d="${d%%/*}"
  echo "$d"
}

ask_domain () {
  local d=""
  while true; do
    d="$(ask_required "HOST del panel (dominio, sin https) ej: d.interking.online")"
    d="$(sanitize_domain "$d")"
    if [[ "$d" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
      echo "$d"
      return 0
    fi
    echo -e "${YEL}⚠ Dominio inválido${RST}"
  done
}

ask_url () {
  local u=""
  while true; do
    u="$(ask_required "URL pública del panel (sin / final) ej: https://d.interking.online")"
    if [[ "$u" != http*://* ]]; then u="https://$u"; fi
    u="${u%/}"
    if [[ "$u" =~ ^https?://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]+)?$ ]]; then
      echo "$u"
      return 0
    fi
    echo -e "${YEL}⚠ URL inválida${RST}"
  done
}

ask_int () {
  local prompt="$1"
  local v=""
  while true; do
    v="$(ask_required "$prompt")"
    if [[ "$v" =~ ^[0-9]+$ ]]; then
      echo "$v"
      return 0
    fi
    echo -e "${YEL}⚠ Debe ser número${RST}"
  done
}

apt_safe () {
  if ! apt install -y "$@"; then
    warn "No se pudo instalar: $* (se continúa)"
    return 0
  fi
}

export DEBIAN_FRONTEND=noninteractive

need_root
clear || true

PROJECT_DIR="/root/DTunnel"
[ -d "$PROJECT_DIR" ] || die "No existe $PROJECT_DIR. Cloná el repo ahí y reintentá."
cd "$PROJECT_DIR"

title "INSTALADOR KING•VPN — DTunnel (PRO)"
echo -e "${DIM}Se ejecuta dentro de /root/DTunnel. Genera .env, DB, Prisma y deja todo listo.${RST}"
echo

title "CONFIG"
PANEL_DOMAIN="$(ask_domain)"
PANEL_PORT="$(ask_port)"
APP_BASE_URL="$(ask_url)"
MP_ACCESS_TOKEN="$(ask_required "Token Mercado Pago (APP_USR-...)" )"
PLAN_PRICE_ARS="$(ask_int "Precio del plan (ARS) para test/venta (ej 100 o 7000)")"
MP_STORE_NAME="$(ask_required "Nombre que aparece en Mercado Pago (ej: KING•VPN)" )"

echo
ok "HOST: $PANEL_DOMAIN"
ok "PUERTO: $PANEL_PORT"
ok "APP_BASE_URL: $APP_BASE_URL"
ok "MP_ACCESS_TOKEN: cargado"
ok "PLAN_PRICE_ARS: $PLAN_PRICE_ARS"
ok "MP_STORE_NAME: $MP_STORE_NAME"
echo

title "DEPENDENCIAS"
step "Actualizando sistema..."
apt update -y
apt upgrade -y

step "Instalando dependencias base..."
apt install -y curl build-essential openssl git unzip zip ca-certificates software-properties-common ufw nginx wget

step "Node 18 + herramientas..."
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE '^v18\.'; then
  apt remove -y nodejs libnode-dev node-typescript >/dev/null 2>&1 || true
  apt autoremove -y >/dev/null 2>&1 || true
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
else
  ok "Node OK: $(node -v)"
fi

if ! command -v pm2 >/dev/null 2>&1; then npm install -g pm2; fi
if ! command -v tsc >/dev/null 2>&1; then npm install -g typescript; fi

apt_safe openjdk-11-jdk
apt_safe apktool
apt_safe apksigner
apt_safe android-sdk-build-tools

if [ ! -f /usr/local/bin/apktool ]; then
  wget -O /usr/local/bin/apktool https://raw.githubusercontent.com/iBotPeaches/Apktool/master/scripts/linux/apktool
  chmod +x /usr/local/bin/apktool
fi
if [ ! -f /usr/local/bin/apktool.jar ]; then
  wget -O /usr/local/bin/apktool.jar https://bitbucket.org/iBotPeaches/apktool/downloads/apktool_2.9.3.jar
fi

echo
title "CHECK"
node -v
npm -v
tsc -v || true
java -version || true
apktool -version || true
apksigner version || true
echo
ok "Herramientas listas"

title "PROYECTO"
[ -f "$PROJECT_DIR/package.json" ] || die "No encuentro package.json en $PROJECT_DIR"

step "npm install (deps del proyecto)..."
npm install

step "Instalando libs necesarias (mercadopago + sharp)..."
npm i mercadopago sharp

title ".ENV + DB"
mkdir -p "$PROJECT_DIR/prisma"

DATABASE_URL='file:./prisma/database.db'
CSRF_SECRET="$(openssl rand -hex 16)"
JWT_SECRET_KEY="$(openssl rand -hex 32)"
JWT_SECRET_REFRESH="$(openssl rand -hex 32)"

cat > "$PROJECT_DIR/.env" <<EOF
PORT=$PANEL_PORT
NODE_ENV=production
DATABASE_URL="$DATABASE_URL"
CSRF_SECRET=$CSRF_SECRET
JWT_SECRET_KEY=$JWT_SECRET_KEY
JWT_SECRET_REFRESH=$JWT_SECRET_REFRESH
MP_ACCESS_TOKEN=$MP_ACCESS_TOKEN
APP_BASE_URL=$APP_BASE_URL
FRONTEND_RETURN_URL=$APP_BASE_URL
MP_STORE_NAME=$MP_STORE_NAME
EOF

ok ".env generado"

if [ -f "$PROJECT_DIR/prisma/prisma/database.db" ] && [ ! -s "$PROJECT_DIR/prisma/database.db" ]; then
  warn "DB duplicada detectada: prisma/prisma/database.db -> prisma/database.db"
  cp -f "$PROJECT_DIR/prisma/prisma/database.db" "$PROJECT_DIR/prisma/database.db"
  ok "DB corregida"
fi

step "Prisma: generate..."
npx prisma generate

step "Prisma: db push..."
npx prisma db push

step "Build..."
npm run build

title "SEED PLAN"
if ! command -v sqlite3 >/dev/null 2>&1; then
  apt install -y sqlite3
fi

DB_PATH="$PROJECT_DIR/prisma/database.db"
[ -f "$DB_PATH" ] || die "No existe DB en $DB_PATH"
[ -s "$DB_PATH" ] || warn "DB está vacía (0 bytes). Prisma no escribió donde corresponde."

TABLES="$(sqlite3 "$DB_PATH" ".tables" || true)"
echo "$TABLES" | grep -q "plans" || die "No existe tabla plans en $DB_PATH (DATABASE_URL mal o prisma falló)."

sqlite3 "$DB_PATH" "
INSERT INTO plans (code, name, months, price_ars, is_active, created_at, updated_at)
VALUES ('plan_1m', 'Acceso mensual $MP_STORE_NAME', 1, $PLAN_PRICE_ARS, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(code) DO UPDATE SET
  name=excluded.name,
  months=excluded.months,
  price_ars=excluded.price_ars,
  is_active=1,
  updated_at=CURRENT_TIMESTAMP;
"

ok "Plan plan_1m listo ($PLAN_PRICE_ARS ARS)"

title "SSL + NGINX"
NGINX_DIR="$PROJECT_DIR/nginx"
mkdir -p "$NGINX_DIR"
NGINX_CONF="/etc/nginx/sites-available/dtunnel.conf"

if [ ! -f "$NGINX_DIR/fullchain.pem" ] || [ ! -f "$NGINX_DIR/privkey.pem" ]; then
  openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "$NGINX_DIR/privkey.pem" \
    -out "$NGINX_DIR/fullchain.pem" \
    -subj "/C=AR/ST=BuenosAires/O=KINGVPN/CN=$PANEL_DOMAIN"
fi

cat > "$NGINX_CONF" <<EOF
server {
  listen 80;
  server_name $PANEL_DOMAIN;
  return 301 https://\$host\$request_uri;
}

server {
  listen 443 ssl;
  server_name $PANEL_DOMAIN;

  ssl_certificate $NGINX_DIR/fullchain.pem;
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
rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl restart nginx
systemctl enable nginx >/dev/null 2>&1 || true
ok "NGINX OK"

title "RESUMEN DB"
echo -e "${BLU}.tables:${RST}"
sqlite3 "$DB_PATH" ".tables" || true
echo
echo -e "${BLU}counts:${RST}"
sqlite3 "$DB_PATH" "SELECT 'users' as t, COUNT(*) c FROM users UNION ALL SELECT 'cdn',COUNT(*) FROM cdn UNION ALL SELECT 'categories',COUNT(*) FROM categories UNION ALL SELECT 'app_configs',COUNT(*) FROM app_configs UNION ALL SELECT 'app_texts',COUNT(*) FROM app_texts UNION ALL SELECT 'app_layouts',COUNT(*) FROM app_layouts UNION ALL SELECT 'app_notifications',COUNT(*) FROM app_notifications UNION ALL SELECT 'plans',COUNT(*) FROM plans UNION ALL SELECT 'payments',COUNT(*) FROM payments UNION ALL SELECT 'access_events',COUNT(*) FROM access_events;"

title "FINAL"
echo -e "${BOX_MID} ${GRN}✔${RST} Proyecto:      ${WHT}$PROJECT_DIR${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} .env:          ${WHT}$PROJECT_DIR/.env${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} DB:            ${WHT}$DB_PATH${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Host:          ${WHT}$PANEL_DOMAIN${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Puerto:        ${WHT}$PANEL_PORT${RST}"
echo -e "${BOX_MID} ${CYA}➜${RST} Iniciar PM2:   ${WHT}pm2 start ecosystem.config.js --update-env${RST}"
echo -e "${MAG}${BOX_BOT}${RST}"
echo
ok "Listo."
