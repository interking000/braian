#!/usr/bin/env bash
# ============================================================
#   KING•VPN — install.sh (DTunnel)  ✅ SUPER INTELIGENTE
#   - Idempotente: lo podés correr 10 veces sin romper nada
#   - Blindado: corta con error claro + línea + comando
#   - Deja TODO listo: DB, Prisma, planes, apktool 2.10.0, nginx, pm2
#
#   Uso:
#     chmod +x install.sh
#     sudo -i
#     ./install.sh
# ============================================================

set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

# --------------------------
# ESTILO / LOGS
# --------------------------
RED="\033[0;31m"; GRN="\033[0;32m"; YEL="\033[1;33m"; CYA="\033[0;36m"; MAG="\033[0;35m"; WHT="\033[1;37m"; DIM="\033[2m"; RST="\033[0m"
LINE="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
BOX_TOP="┏${LINE}┓"; BOX_BOT="┗${LINE}┛"; BOX_MID="┃"

title(){ echo -e "${MAG}${BOX_TOP}${RST}"; printf "${MAG}${BOX_MID}${RST} ${WHT}%-56s${MAG}${BOX_MID}${RST}\n" "$1"; echo -e "${MAG}${BOX_BOT}${RST}"; }
step(){ echo -e "${CYA}➜${RST} ${WHT}$1${RST}"; }
ok(){   echo -e "${GRN}✔${RST} ${WHT}$1${RST}"; }
warn(){ echo -e "${YEL}⚠${RST} ${WHT}$1${RST}"; }
die(){  echo -e "${RED}✖${RST} ${WHT}$1${RST}"; exit 1; }

trap 'code=$?; echo -e "\n${RED}✖ FALLÓ${RST} (exit=$code) en línea ${YEL}${LINENO}${RST}: ${DIM}${BASH_COMMAND}${RST}\n"; exit $code' ERR

need_root(){ [ "$(id -u)" -eq 0 ] || die "Ejecutá como root: sudo -i"; }

# --------------------------
# HELPERS
# --------------------------
ask_required () {
  local prompt="$1" v=""
  while true; do
    read -r -p "➜ $prompt: " v
    if [[ -n "${v// }" ]]; then echo "$v"; return 0; fi
    echo -e "${YEL}⚠ Este valor es obligatorio${RST}"
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
    if [[ "$d" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then echo "$d"; return 0; fi
    echo -e "${YEL}⚠ Dominio inválido${RST}"
  done
}

ask_port () {
  local p
  while true; do
    p="$(ask_required "Puerto interno del panel (1-65535)")"
    if [[ "$p" =~ ^[0-9]+$ ]] && [ "$p" -ge 1 ] && [ "$p" -le 65535 ]; then echo "$p"; return 0; fi
    echo -e "${YEL}⚠ Puerto inválido (1-65535)${RST}"
  done
}

ask_price () {
  local p
  while true; do
    p="$(ask_required "Precio del plan en ARS (ej: 7000)")"
    if [[ "$p" =~ ^[0-9]+$ ]] && [ "$p" -ge 1 ] && [ "$p" -le 999999999 ]; then echo "$p"; return 0; fi
    echo -e "${YEL}⚠ Precio inválido${RST}"
  done
}

# epoch ms
now_ms(){ date +%s%3N; }

# sqlite escape single quotes
sql_escape(){ echo "${1//\'/\'\'}"; }

# .env upsert
env_set () {
  local file="$1" key="$2" val="$3"
  # si ya existe, reemplaza. si no, agrega.
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    # sed seguro (no -i raro)
    perl -0777 -pe "s|^${key}=.*\$|${key}=${val}|m" -i "$file"
  else
    echo "${key}=${val}" >> "$file"
  fi
}

# package install idempotente
apt_install(){
  step "apt install: $*"
  apt-get install -y --no-install-recommends "$@"
}

# --------------------------
# PATHS
# --------------------------
PROJECT_DIR="/root/DTunnel"
ENV_FILE="$PROJECT_DIR/.env"
DB_DIR="$PROJECT_DIR/prisma"
DB_FILE="$DB_DIR/database.db"
NGINX_DIR="$PROJECT_DIR/nginx"
NGINX_CONF="/etc/nginx/sites-available/dtunnel.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/dtunnel.conf"

# --------------------------
# START
# --------------------------
need_root
clear || true
title "KING•VPN — Instalador DTunnel (SUPER INTELIGENTE)"
echo -e "${DIM}Idempotente • Apktool 2.10 • Prisma blindado • Planes OK • Nginx + PM2${RST}\n"

cd "$PROJECT_DIR" 2>/dev/null || die "No existe $PROJECT_DIR. Cloná el repo ahí (/root/DTunnel)."
[ -f "$PROJECT_DIR/package.json" ] || die "No existe package.json en $PROJECT_DIR"
[ -f "$PROJECT_DIR/prisma/schema.prisma" ] || die "No existe prisma/schema.prisma"

mkdir -p "$DB_DIR" "$NGINX_DIR"

title "CONFIGURACIÓN (5 datos)"
PANEL_HOST="$(ask_domain)"
PANEL_PORT="$(ask_port)"
MP_ACCESS_TOKEN="$(ask_required "TOKEN MercadoPago (APP_USR-...)" )"
PLAN_PRICE_ARS="$(ask_price)"
MP_STORE_NAME="$(ask_required "Nombre que se muestra en MercadoPago (ej: KING VPN)" )"

echo
ok "HOST:  $PANEL_HOST"
ok "PORT:  $PANEL_PORT"
ok "PLAN:  ARS $PLAN_PRICE_ARS"
ok "MP:    (token cargado)"
ok "MPNAME:\"$MP_STORE_NAME\""
echo

# --------------------------
# SISTEMA
# --------------------------
title "DEPENDENCIAS DEL SISTEMA (IDEMPOTENTE)"
step "APT update/upgrade..."
apt-get update -y
apt-get upgrade -y

apt_install curl ca-certificates gnupg git unzip zip wget
apt_install build-essential openssl
apt_install nginx ufw sqlite3

# Node 18 (estable)
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE '^v18\.'; then
  step "Instalando Node.js 18..."
  apt-get remove -y nodejs libnode-dev node-typescript >/dev/null 2>&1 || true
  apt-get autoremove -y || true
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt_install nodejs
else
  ok "Node OK: $(node -v)"
fi

# PM2 + TS
if ! command -v pm2 >/dev/null 2>&1; then
  step "Instalando PM2..."
  npm i -g pm2
else
  ok "PM2 OK: $(pm2 -v)"
fi

if ! command -v tsc >/dev/null 2>&1; then
  step "Instalando TypeScript..."
  npm i -g typescript
else
  ok "TypeScript OK: $(tsc -v)"
fi

# Java + apksigner
if ! command -v java >/dev/null 2>&1; then
  step "Instalando OpenJDK 11..."
  apt_install openjdk-11-jdk
else
  ok "Java OK"
fi

if ! command -v apksigner >/dev/null 2>&1; then
  step "Instalando apksigner..."
  apt_install apksigner || warn "No pude instalar apksigner (seguimos igual)."
else
  ok "apksigner OK"
fi

# APKTOOL 2.10.0 (FORZADO)
title "APKTOOL 2.10.0 (FIJO / SIN BUGS)"
step "Forzando apktool 2.10.0..."
rm -f /usr/local/bin/apktool /usr/local/bin/apktool.jar /usr/bin/apktool 2>/dev/null || true
apt-get remove -y apktool >/dev/null 2>&1 || true

curl -L --fail -o /usr/local/bin/apktool \
  https://raw.githubusercontent.com/iBotPeaches/Apktool/master/scripts/linux/apktool
chmod +x /usr/local/bin/apktool

curl -L --fail -o /usr/local/bin/apktool.jar \
  https://github.com/iBotPeaches/Apktool/releases/download/v2.10.0/apktool_2.10.0.jar
chmod 644 /usr/local/bin/apktool.jar

apktool --version >/dev/null 2>&1 || die "apktool no quedó funcionando"
ok "apktool OK: $(apktool --version)"

# --------------------------
# PROYECTO (npm)
# --------------------------
title "DEPENDENCIAS DEL PROYECTO"
cd "$PROJECT_DIR"

if [ -f package-lock.json ]; then
  step "npm ci (package-lock detectado)..."
  npm ci
else
  step "npm install..."
  npm install
fi

# libs extra que pediste
step "Asegurando libs: mercadopago + sharp..."
npm i mercadopago sharp >/dev/null 2>&1 || npm install mercadopago sharp
ok "Deps OK"

# --------------------------
# .ENV (NO rompe secrets si ya existe)
# --------------------------
title ".ENV (BLINDADO / SIN ROMPER SECRETOS)"
if [ ! -f "$ENV_FILE" ]; then
  step "Creando .env nuevo..."
  touch "$ENV_FILE"
  echo "# KING•VPN — DTunnel (.env)" > "$ENV_FILE"
  echo "" >> "$ENV_FILE"
fi

# Secrets sólo si no existen
if ! grep -qE '^CSRF_SECRET=' "$ENV_FILE"; then env_set "$ENV_FILE" "CSRF_SECRET" "$(openssl rand -hex 16)"; fi
if ! grep -qE '^JWT_SECRET_KEY=' "$ENV_FILE"; then env_set "$ENV_FILE" "JWT_SECRET_KEY" "$(openssl rand -hex 32)"; fi
if ! grep -qE '^JWT_SECRET_REFRESH=' "$ENV_FILE"; then env_set "$ENV_FILE" "JWT_SECRET_REFRESH" "$(openssl rand -hex 32)"; fi

# Vars operativas (se actualizan siempre)
env_set "$ENV_FILE" "PORT" "$PANEL_PORT"
env_set "$ENV_FILE" "NODE_ENV" "production"
env_set "$ENV_FILE" "DATABASE_URL" "\"file:$DB_FILE\""

# MP (validación placeholder)
if [[ "$MP_ACCESS_TOKEN" == *"<<APP_USR"* ]] || [[ "$MP_ACCESS_TOKEN" != APP_USR-* ]]; then
  warn "El MP_ACCESS_TOKEN no parece real (debería empezar con APP_USR-). Igual lo guardo, pero MercadoPago puede fallar."
fi
env_set "$ENV_FILE" "MP_ACCESS_TOKEN" "$MP_ACCESS_TOKEN"
env_set "$ENV_FILE" "MP_STORE_NAME" "\"$MP_STORE_NAME\""

# URLs
env_set "$ENV_FILE" "APP_BASE_URL" "\"https://$PANEL_HOST\""
env_set "$ENV_FILE" "FRONTEND_RETURN_URL" "\"https://$PANEL_HOST\""

ok ".env OK: $ENV_FILE"
ok "DB URL: file:$DB_FILE"

# --------------------------
# PRISMA (BLINDADO)
# --------------------------
title "PRISMA + DB (BLINDADO)"

mkdir -p "$DB_DIR"

step "Prisma db push..."
npx prisma db push --schema "$PROJECT_DIR/prisma/schema.prisma"

step "Prisma generate..."
npx prisma generate --schema "$PROJECT_DIR/prisma/schema.prisma"

# Si por alguna razón Prisma creó prisma/prisma/database.db -> mover
if [ -f "$PROJECT_DIR/prisma/prisma/database.db" ] && [ ! -f "$DB_FILE" ]; then
  warn "DB creada en prisma/prisma/database.db — corrigiendo..."
  mv -f "$PROJECT_DIR/prisma/prisma/database.db" "$DB_FILE"
  rmdir "$PROJECT_DIR/prisma/prisma" 2>/dev/null || true
fi

# Asegurar DB existe
if [ ! -f "$DB_FILE" ]; then
  die "No existe DB esperada: $DB_FILE"
fi

# --------------------------
# SEED PLANES (timestamps en ms + escape)
# --------------------------
title "SEED PLANES (SIN UTF / SIN FECHAS ROTAS)"
NOW_MS="$(now_ms)"
STORE_ESCAPED="$(sql_escape "$MP_STORE_NAME")"
PLAN_NAME="Acceso mensual $STORE_ESCAPED"
PLAN_NAME_ESC="$(sql_escape "$PLAN_NAME")"

step "Upsert plan_1m..."
sqlite3 "$DB_FILE" "
INSERT INTO plans (code, name, months, price_ars, is_active, created_at, updated_at)
VALUES ('plan_1m', '$PLAN_NAME_ESC', 1, $PLAN_PRICE_ARS, 1, $NOW_MS, $NOW_MS)
ON CONFLICT(code) DO UPDATE SET
  name=excluded.name,
  months=excluded.months,
  price_ars=excluded.price_ars,
  is_active=excluded.is_active,
  updated_at=$NOW_MS;
" || die "No pude insertar/actualizar plan_1m"

ok "Plan OK"

step "Verificación plan:"
sqlite3 "$DB_FILE" "
.headers on
.mode column
SELECT code, name, months, price_ars, is_active, datetime(updated_at/1000,'unixepoch') AS updated_at
FROM plans WHERE code='plan_1m';
" || true

# --------------------------
# BUILD
# --------------------------
title "BUILD"
step "npm run build..."
npm run build
ok "Build OK"

# --------------------------
# NGINX + SSL (autofirmado)
# --------------------------
title "NGINX + SSL (AUTO)"
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

step "Escribiendo config nginx..."
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

  client_max_body_size 30m;

  location / {
    proxy_pass http://127.0.0.1:$PANEL_PORT;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
EOF

ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
[ -e /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default || true

step "nginx -t..."
nginx -t
systemctl restart nginx
systemctl enable nginx >/dev/null 2>&1 || true
ok "Nginx OK"

# --------------------------
# PM2 START (idempotente)
# --------------------------
title "PM2 (AUTO START)"
cd "$PROJECT_DIR"

# nombre estándar
APP_NAME="DTunnel"

if pm2 list | grep -q "$APP_NAME"; then
  step "Reiniciando PM2 ($APP_NAME) con env actualizado..."
  pm2 restart "$APP_NAME" --update-env || true
else
  if [ -f "$PROJECT_DIR/ecosystem.config.js" ]; then
    step "Iniciando PM2 con ecosystem.config.js..."
    pm2 start "$PROJECT_DIR/ecosystem.config.js" --update-env
  else
    # fallback típico
    if [ -f "$PROJECT_DIR/build/index.js" ]; then
      step "Iniciando PM2 con build/index.js..."
      pm2 start "$PROJECT_DIR/build/index.js" --name "$APP_NAME" --update-env
    else
      warn "No encontré build/index.js ni ecosystem.config.js. Iniciá manual."
    fi
  fi
fi

pm2 save >/dev/null 2>&1 || true
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
ok "PM2 OK"

# --------------------------
# CHEQUEOS FINALES (rápidos pero útiles)
# --------------------------
title "CHEQUEO FINAL (TODO LISTO)"

ok "Proyecto: $PROJECT_DIR"
ok "Host:     https://$PANEL_HOST"
ok "Port:     $PANEL_PORT"
ok "DB:       $DB_FILE"

step "Tablas principales:"
sqlite3 "$DB_FILE" ".tables" | tr -s ' ' | sed 's/^/• /' || true

step "Estado apktool:"
apktool --version || true

echo
ok "Comandos útiles:"
echo -e "• Logs app:   ${WHT}pm2 logs DTunnel --lines 200${RST}"
echo -e "• Ver plan:   ${WHT}sqlite3 $DB_FILE \"SELECT code,name,price_ars,is_active,updated_at FROM plans;\"${RST}"
echo -e "• Reiniciar:  ${WHT}pm2 restart DTunnel --update-env${RST}"
echo -e "• Nginx test: ${WHT}nginx -t && systemctl restart nginx${RST}"
echo
title "LISTO ✅ (1 SOLA CORRIDA, SIN DRAMA)"
