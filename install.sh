#!/bin/bash
# ============================================================
#   KING•VPN — INSTALADOR COMPLETO DTunnel (LIMPIO + PRO)
#   ✅ Pregunta TODO lo importante (sin defaults)
#   ✅ Genera .env correcto (prisma/database.db)
#   ✅ Crea/actualiza el PLAN (tabla plans) en SQLite
#   ✅ Genera SSL con TU dominio (CN = tu dominio)
#   ✅ Configura NGINX con TU dominio + TU puerto
#   ✅ Idempotente (no rompe si lo corrés 2 veces)
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
die ()  { echo -e night's; echo -e "${RED}✖${RST} ${WHT}$1${RST}"; exit 1; }

need_root () {
  if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Este script debe ejecutarse como root${RST}"
    exit 1
  fi
}

# --------------------------
# INPUT helpers
# --------------------------
ask_required () {
  local prompt="$1"
  local var
  while true; do
    read -r -p "➜ $prompt: " var
    if [[ -n "${var// }" ]]; then
      echo "$var"
      return 0
    fi
    echo -e "${YEL}⚠ Este valor es obligatorio${RST}"
  done
}

ask_int () {
  local prompt="$1"
  local v
  while true; do
    v="$(ask_required "$prompt")"
    if [[ "$v" =~ ^[0-9]+$ ]]; then
      echo "$v"
      return 0
    fi
    echo -e "${YEL}⚠ Debe ser un número entero${RST}"
  done
}

ask_port () {
  local p
  while true; do
    p="$(ask_required "Agregá el puerto para el panel")"
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
  local d
  while true; do
    d="$(ask_required "Agregá el dominio del panel (sin https)")"
    d="$(sanitize_domain "$d")"
    if [[ "$d" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
      echo "$d"
      return 0
    fi
    echo -e "${YEL}⚠ Dominio inválido${RST}"
  done
}

ask_url () {
  local u
  while true; do
    u="$(ask_required "Agregá la URL pública del panel (sin / final)")"
    if [[ "$u" != http*://* ]]; then
      u="https://$u"
    fi
    u="${u%/}"
    if [[ "$u" =~ ^https?://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]+)?$ ]]; then
      echo "$u"
      return 0
    fi
    echo -e "${YEL}⚠ URL inválida${RST}"
  done
}

ask_plan_code () {
  local c
  while true; do
    c="$(ask_required "Código del plan (ej: plan_1m)")"
    if [[ "$c" =~ ^[A-Za-z0-9_-]+$ ]]; then
      echo "$c"
      return 0
    fi
    echo -e "${YEL}⚠ Código inválido (solo letras/números/_/-)${RST}"
  done
}

# --------------------------
# MAIN
# --------------------------
need_root
clear || true
title "Instalador KING•VPN — DTunnel"
echo -e "${DIM}Instala, compila, configura NGINX+SSL, crea DB y crea/actualiza el plan.${RST}"
echo

PROJECT_DIR="/root/DTunnel"
NGINX_DIR="$PROJECT_DIR/nginx"
ENV_FILE="$PROJECT_DIR/.env"
NGINX_CONF="/etc/nginx/sites-available/dtunnel.conf"
DB_FILE="$PROJECT_DIR/prisma/database.db"

mkdir -p "$PROJECT_DIR" "$NGINX_DIR"

title "CONFIGURACIÓN OBLIGATORIA"

PANEL_PORT="$(ask_port)"
PANEL_DOMAIN="$(ask_domain)"
APP_BASE_URL="$(ask_url)"

echo
echo -e "${WHT}Mercado Pago Access Token (ejemplo):${RST}"
echo -e "${DIM}APP_USR-292459445257292-010909-ad9da859bf8eb657422b278edbbef85f-517943228${RST}"
MP_ACCESS_TOKEN="$(ask_required "Pegá tu Access Token de Mercado Pago")"

echo
title "CONFIGURACIÓN DEL PLAN (EDITABLE)"
PLAN_CODE="$(ask_plan_code)"
PLAN_NAME="$(ask_required "Nombre del plan (ej: Acceso mensual KING•VPN)")"
PLAN_MONTHS="$(ask_int "Meses que suma (ej: 1)")"
PLAN_PRICE="$(ask_int "Precio en ARS (ej: 7000 o para test 100)")"

echo
ok "Puerto: $PANEL_PORT"
ok "Dominio: $PANEL_DOMAIN"
ok "APP_BASE_URL: $APP_BASE_URL"
ok "MP_ACCESS_TOKEN: (cargado)"
ok "PLAN: $PLAN_CODE | $PLAN_NAME | meses=$PLAN_MONTHS | $PLAN_PRICE ARS"

echo
title "INSTALANDO DEPENDENCIAS"

step "Actualizando sistema..."
apt update -y
apt upgrade -y

step "Instalando dependencias base..."
apt install -y \
  curl build-essential openssl git unzip zip ca-certificates software-properties-common \
  nginx ufw sqlite3

# Node 18
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE '^v18\.'; then
  step "Instalando Node.js 18..."
  apt remove -y nodejs libnode-dev node-typescript >/dev/null 2>&1 || true
  apt autoremove -y || true
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
else
  ok "Node.js 18 ya instalado: $(node -v)"
fi

# pm2
if ! command -v pm2 >/dev/null 2>&1; then
  step "Instalando PM2..."
  npm install -g pm2
else
  ok "PM2 ya instalado: $(pm2 -v)"
fi

# typescript
if ! command -v tsc >/dev/null 2>&1; then
  step "Instalando TypeScript..."
  npm install -g typescript
else
  ok "TypeScript ya instalado: $(tsc -v)"
fi

# Java opcional
if ! command -v java >/dev/null 2>&1; then
  step "Instalando OpenJDK 11..."
  apt install -y openjdk-11-jdk
else
  ok "Java ya instalado"
fi

echo
title "PROYECTO DTUNNEL"

if [ ! -f "$PROJECT_DIR/package.json" ]; then
  warn "No existe package.json en $PROJECT_DIR"
  echo -e "${YEL}Cloná/subí tu repo DTunnel en ${WHT}$PROJECT_DIR${YEL} y volvé a correr este install.${RST}"
  exit 1
fi

cd "$PROJECT_DIR"

step "Instalando dependencias del proyecto (npm install)..."
npm install

step "Generando archivo .env (LIMPIO)..."
DATABASE_PATH='file:./prisma/database.db'
CSRF_SECRET="$(openssl rand -hex 16)"
JWT_SECRET_KEY="$(openssl rand -hex 32)"
JWT_SECRET_REFRESH="$(openssl rand -hex 32)"

cat <<EOF > "$ENV_FILE"
# ===============================
# SERVIDOR
# ===============================
PORT=$PANEL_PORT
NODE_ENV=production

# ===============================
# PRISMA SQLITE
# ===============================
DATABASE_URL="$DATABASE_PATH"

# ===============================
# SEGURIDAD
# ===============================
CSRF_SECRET=$CSRF_SECRET
JWT_SECRET_KEY=$JWT_SECRET_KEY
JWT_SECRET_REFRESH=$JWT_SECRET_REFRESH

# ===============================
# MERCADO PAGO
# ===============================
MP_ACCESS_TOKEN=$MP_ACCESS_TOKEN
APP_BASE_URL=$APP_BASE_URL
FRONTEND_RETURN_URL=$APP_BASE_URL
EOF

ok ".env generado en $ENV_FILE"

# Prisma
if [ ! -d "$PROJECT_DIR/prisma" ]; then
  die "No existe carpeta prisma/ en el proyecto."
fi

step "Prisma: sincronizando base de datos (NO borra tu DB)..."
npx prisma db push

# Validar DB existe
if [ ! -f "$DB_FILE" ]; then
  die "No se creó la DB en $DB_FILE (algo falló con Prisma)."
fi

echo
title "SEED PRO — CREAR/ACTUALIZAR PLAN EN DB"

step "Insert/Update plan en SQLite (idempotente)..."
sqlite3 "$DB_FILE" <<SQL
BEGIN;

-- Si existe el plan, lo actualizamos
UPDATE plans
SET
  name      = '$PLAN_NAME',
  months    = $PLAN_MONTHS,
  price_ars = $PLAN_PRICE,
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE code = '$PLAN_CODE';

-- Si NO existía (changes()==0), lo insertamos
INSERT INTO plans (code, name, months, price_ars, is_active, created_at, updated_at)
SELECT '$PLAN_CODE', '$PLAN_NAME', $PLAN_MONTHS, $PLAN_PRICE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE (SELECT changes() = 0);

COMMIT;
SQL

ok "Plan listo en DB: $PLAN_CODE"

step "Verificando plan..."
sqlite3 "$DB_FILE" "SELECT id, code, name, months, price_ars, is_active FROM plans WHERE code='$PLAN_CODE' LIMIT 1;"

echo
title "BUILD + NGINX + SSL"

step "Build: npm run build"
npm run build

# SSL (autofirmado)
step "Generando certificados SSL (autofirmados) para $PANEL_DOMAIN..."
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout "$NGINX_DIR/privkey.pem" \
  -out "$NGINX_DIR/fullchain.pem" \
  -subj "/C=AR/ST=BuenosAires/O=KINGVPN/CN=$PANEL_DOMAIN"

ok "SSL generado en $NGINX_DIR"

# Nginx config
step "Escribiendo config NGINX..."
cat <<EOF > "$NGINX_CONF"
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
[ -e /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default || true

step "Probando NGINX..."
nginx -t

step "Reiniciando NGINX..."
systemctl restart nginx
systemctl enable nginx >/dev/null 2>&1 || true
ok "NGINX OK"

echo
title "INICIAR PANEL (PM2)"

if [ -f "$PROJECT_DIR/ecosystem.config.js" ]; then
  step "Iniciando con PM2 (ecosystem.config.js)..."
  pm2 start "$PROJECT_DIR/ecosystem.config.js" --update-env || pm2 restart DTunnel --update-env || true
  pm2 save || true
  ok "PM2 iniciado"
else
  warn "No encontré ecosystem.config.js. Intento iniciar con 'npm start' via PM2..."
  pm2 start npm --name DTunnel -- start --update-env || true
  pm2 save || true
fi

echo
title "FINALIZADO"
echo -e "${BOX_MID} ${GRN}✔${RST} Proyecto:              ${WHT}$PROJECT_DIR${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} .env:                  ${WHT}$ENV_FILE${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Prisma DB:             ${WHT}$DB_FILE${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Dominio:               ${WHT}$PANEL_DOMAIN${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Puerto interno:        ${WHT}$PANEL_PORT${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Plan:                  ${WHT}$PLAN_CODE ($PLAN_PRICE ARS)${RST}"
echo -e "${BOX_MID} ${CYA}➜${RST} Logs PM2:              ${WHT}pm2 logs DTunnel${RST}"
echo -e "${MAG}${BOX_BOT}${RST}"
echo
ok "Listo."
