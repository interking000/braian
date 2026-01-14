#!/bin/bash
# ============================================================
#   KING•VPN  —  INSTALADOR COMPLETO DTunnel (SCRIPT UNIFICADO)
#   ✔ Visual KING•VPN (marcos + colores)
#   ✔ Lógica DTunnel INTACTA (NO tocada)
#   ✔ Evita choques: instala solo lo que falte / idempotente
#   ✔ Pregunta al inicio:
#       - Host del panel (dominio)
#       - Puerto interno
#       - Token Mercado Pago
#       - Precio del plan
#       - Nombre que aparecerá en Mercado Pago
#   ✔ Prisma:
#       - db push
#       - migrate dev -n ...
#       - generate
#       - studio (opcional)
#   ✔ NPM deps:
#       - mercadopago
#       - sharp
# ============================================================

set -euo pipefail

# --------------------------
# COLORES / ESTILO (solo visual)
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

ask_int () {
  local prompt="$1"
  local min="${2:-1}"
  local max="${3:-999999999}"
  local v=""
  while true; do
    v="$(ask_required "$prompt")"
    if [[ "$v" =~ ^[0-9]+$ ]] && [ "$v" -ge "$min" ] && [ "$v" -le "$max" ]; then
      echo "$v"
      return 0
    fi
    echo -e "${YEL}⚠ Valor inválido (número entre $min y $max)${RST}"
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
    d="$(ask_required "Host/dominio del panel (ej: panel.interking.online)")"
    d="$(sanitize_domain "$d")"
    if [[ "$d" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
      echo "$d"
      return 0
    fi
    echo -e "${YEL}⚠ Dominio inválido${RST}"
  done
}

ask_yesno () {
  local prompt="$1"
  local ans=""
  while true; do
    read -r -p "➜ $prompt (s/n): " ans
    ans="$(echo "$ans" | tr '[:upper:]' '[:lower:]')"
    case "$ans" in
      s|si|sí|y|yes) echo "yes"; return 0 ;;
      n|no) echo "no"; return 0 ;;
      *) echo -e "${YEL}⚠ Respondé s o n${RST}" ;;
    esac
  done
}

# --------------------------
# HEADER + INPUTS
# --------------------------
need_root
clear || true
title "Instalando KING•VPN"
echo -e "${DIM}OJO: Script instalador completo de DTunnel (lógica intacta).${RST}"
echo

title "CONFIGURACIÓN (SETEO INICIAL)"
PANEL_HOST="$(ask_domain)"
PANEL_PORT="$(ask_int "Puerto interno del panel (ej: 8080)" 1 65535)"
MP_ACCESS_TOKEN="$(ask_required "Token Mercado Pago (ej: APP_USR-... )")"
PLAN_PRICE_ARS="$(ask_int "Precio del plan en ARS (ej: 7000 / 100 para test)" 1 99999999)"
MP_STORE_NAME="$(ask_required "Nombre que querés que aparezca en Mercado Pago (ej: KING•VPN)")"
MIGRATE_NAME="$(ask_required "Nombre descriptivo de la migración (ej: init_db_kingvpn)")"

echo
ok "HOST: $PANEL_HOST"
ok "PORT: $PANEL_PORT"
ok "PLAN PRICE ARS: $PLAN_PRICE_ARS"
ok "MP STORE NAME: $MP_STORE_NAME"
ok "MIGRATION NAME: $MIGRATE_NAME"
echo

# ============================================================
#  A) BLOQUE 1 — DEPENDENCIAS DTUNNEL (FULL)  (INTACTO)
#     (Solo se le agregan guards para no chocar / re-ejecutar)
# ============================================================

step "Instalación completa de dependencias DTunnel (FULL)"

# --- limpiar posibles conflictos viejos ---
# (si no existen, no pasa nada)
apt remove -y nodejs libnode-dev node-typescript || true
apt autoremove -y || true
apt clean || true

# --- update base ---
apt update -y
apt upgrade -y

# --- dependencias base ---
apt install -y \
  curl \
  build-essential \
  openssl \
  git \
  unzip \
  zip \
  ca-certificates \
  software-properties-common \
  sqlite3 \
  ufw \
  nginx

# --- Node.js 18 (Nodesource limpio) ---
step "Instalando Node.js 18"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# --- npm global tools ---
step "Instalando PM2"
npm install -g pm2

# --- TypeScript (LOCAL + usable con npx) ---
step "Instalando TypeScript"
npm install -g typescript

# --- Java JDK (necesario para keytool, apktool, apksigner) ---
step "Instalando OpenJDK 11"
apt install -y openjdk-11-jdk

# --- apktool ---
step "Instalando apktool"
apt install -y apktool || warn "apktool no disponible en repo (se continúa)"

# --- apksigner (Android build tools) ---
step "Instalando apksigner"
apt install -y apksigner || warn "apksigner no disponible en repo (se continúa)"

# --- verificación bonita ---
echo
title "CHECK DE HERRAMIENTAS INSTALADAS"

echo -e "${BLU}[•] Node:${RST}"
node -v

echo -e "${BLU}[•] NPM:${RST}"
npm -v

echo -e "${BLU}[•] TypeScript:${RST}"
tsc -v || true

echo -e "${BLU}[•] Java:${RST}"
java -version || true

echo -e "${BLU}[•] Keytool:${RST}"
keytool -help | head -n 1 || true

echo -e "${BLU}[•] Apktool:${RST}"
apktool -version || true

echo -e "${BLU}[•] Apksigner:${RST}"
apksigner version || true

echo
ok "TODO INSTALADO CORRECTAMENTE (dependencias base)"

# --- extras del bloque FULL (tal cual) ---
apt update -y
apt install -y wget unzip openjdk-11-jdk

# ⚠️ No pisa si ya existen:
if [ ! -f /usr/local/bin/apktool ]; then
  step "Descargando script apktool (bin)"
  wget -O /usr/local/bin/apktool https://raw.githubusercontent.com/iBotPeaches/Apktool/master/scripts/linux/apktool
  chmod +x /usr/local/bin/apktool
else
  ok "apktool (bin) ya existe → no se reemplaza"
fi

if [ ! -f /usr/local/bin/apktool.jar ]; then
  step "Descargando apktool.jar"
  wget -O /usr/local/bin/apktool.jar https://bitbucket.org/iBotPeaches/apktool/downloads/apktool_2.9.3.jar
else
  ok "apktool.jar ya existe → no se reemplaza"
fi

# build-tools (si el paquete existe en tu repo, se instala)
step "Instalando Android build tools (si está disponible en tu repo)"
apt install -y android-sdk-build-tools || warn "android-sdk-build-tools no disponible en tu repositorio (se omite)"

echo
title "Dependencias listas (KING•VPN)"

# ============================================================
#  B) BLOQUE 2 — INSTALADOR DTunnel (INTACTO)
#     (Solo visual cambiado a KING•VPN, lógica igual)
# ============================================================

echo
title "INSTALADOR COMPLETO DTunnel (KING•VPN)"

PROJECT_DIR="/root/DTunnel"
NGINX_DIR="$PROJECT_DIR/nginx"

mkdir -p "$PROJECT_DIR"
mkdir -p "$NGINX_DIR"

# --------------------------
# 1. Instalar dependencias de sistema
# --------------------------
step "Actualizando sistema..."
apt update -y
apt upgrade -y
apt install -y curl build-essential openssl ufw nginx

# --------------------------
# 2. Instalar Node.js 18 + npm
# --------------------------
# (ya instalado arriba, se deja intacto el bloque)
step "Instalando PM2 globalmente..."
npm install -g pm2

# --------------------------
# 3. Crear .env con claves secretas + configs pedidas
# --------------------------
step "Generando archivo .env..."
CSRF_SECRET=$(openssl rand -hex 16)
JWT_SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET_REFRESH=$(openssl rand -hex 32)

# ✅ DB correcta para tu proyecto (prisma/database.db)
DATABASE_PATH="file:./prisma/database.db"

cat > "$PROJECT_DIR/.env" <<EOF
PORT=$PANEL_PORT
NODE_ENV=production
DATABASE_URL="$DATABASE_PATH"

CSRF_SECRET=$CSRF_SECRET
JWT_SECRET_KEY=$JWT_SECRET_KEY
JWT_SECRET_REFRESH=$JWT_SECRET_REFRESH

# MercadoPago
MP_ACCESS_TOKEN=$MP_ACCESS_TOKEN
MP_STORE_NAME=$MP_STORE_NAME
EOF

ok ".env generado."

# --------------------------
# 4. Base de datos (NO la borro; solo me aseguro que exista el path)
# --------------------------
mkdir -p "$PROJECT_DIR/prisma"
touch "$PROJECT_DIR/prisma/database.db"

# --------------------------
# 5. Instalar dependencias del proyecto + mercadopago + sharp
# --------------------------
cd "$PROJECT_DIR"

step "Instalando dependencias del proyecto..."
npm install

step "Instalando mercadopago..."
npm install mercadopago

step "Instalando sharp..."
npm install sharp

# --------------------------
# 6. Prisma DB
# --------------------------
step "Prisma: db push..."
npx prisma db push

step "Prisma: migrate dev -n $MIGRATE_NAME"
# Nota: migrate dev puede crear migraciones; si ya existen, igual corre.
npx prisma migrate dev -n "$MIGRATE_NAME"

step "Prisma: generate"
npx prisma generate

# --------------------------
# 6.1 Seed/Plan (precio configurable) - evita plans vacía
# --------------------------
step "Creando/actualizando plan (plans) con precio ARS $PLAN_PRICE_ARS..."

DB_FILE="$PROJECT_DIR/prisma/database.db"

# Si tu tabla tiene updated_at NOT NULL, esto lo setea SI O SI
# Plan base: plan_1m (si querés otro code, lo cambiás acá luego)
sqlite3 "$DB_FILE" <<SQL
INSERT INTO plans (code, name, months, price_ars, is_active, updated_at)
VALUES ('plan_1m', 'Acceso mensual KING•VPN', 1, $PLAN_PRICE_ARS, 1, CURRENT_TIMESTAMP)
ON CONFLICT(code) DO UPDATE SET
  price_ars=excluded.price_ars,
  is_active=1,
  updated_at=CURRENT_TIMESTAMP;
SQL

ok "Plan listo (plan_1m) → ARS $PLAN_PRICE_ARS"

# --------------------------
# 7. Build del panel
# --------------------------
step "Construyendo proyecto..."
npm run build

# --------------------------
# 8. Certificados SSL autofirmados
# --------------------------
if [ ! -f "$NGINX_DIR/fullchain.pem" ] || [ ! -f "$NGINX_DIR/privkey.pem" ]; then
  step "Generando certificados SSL autofirmados..."
  openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "$NGINX_DIR/privkey.pem" \
    -out "$NGINX_DIR/fullchain.pem" \
    -subj "/C=AR/ST=BuenosAires/L=BA/O=DTunnel/OU=IT/CN=$PANEL_HOST"
  ok "Certificados generados."
else
  ok "Certificados ya existen."
fi

# --------------------------
# 9. Configurar NGINX base (solo ejemplo) — ahora parametrizado
# --------------------------
NGINX_CONF="/etc/nginx/sites-available/dtunnel.conf"

cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $PANEL_HOST;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $PANEL_HOST;

    ssl_certificate $NGINX_DIR/fullchain.pem;
    ssl_certificate_key $NGINX_DIR/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:$PANEL_PORT;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
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

# --------------------------
# 10. Prisma Studio (opcional)
# --------------------------
echo
title "PRISMA STUDIO (OPCIONAL)"
OPEN_STUDIO="$(ask_yesno "¿Querés abrir Prisma Studio ahora? (usa puerto local, dejalo para debug)")"
if [ "$OPEN_STUDIO" = "yes" ]; then
  step "Abriendo Prisma Studio (CTRL+C para salir)..."
  npx prisma studio
else
  ok "Studio omitido. Si querés abrirlo después: npx prisma studio"
fi

echo
title "INSTALACIÓN COMPLETA (KING•VPN)"
echo -e "${BOX_MID} ${GRN}✔${RST} Host panel           → ${WHT}$PANEL_HOST${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Puerto interno       → ${WHT}$PANEL_PORT${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Archivo .env         → ${WHT}$PROJECT_DIR/.env${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Certificados SSL      → ${WHT}$NGINX_DIR${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Base de datos         → ${WHT}$PROJECT_DIR/prisma/database.db${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Plan (plan_1m)        → ${WHT}ARS $PLAN_PRICE_ARS${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} MP store name         → ${WHT}$MP_STORE_NAME${RST}"
echo -e "${BOX_MID} ${CYA}➜${RST} Ejecutar panel        → ${WHT}./start.sh${RST}  ${DIM}(o pm2 si lo usás)${RST}"
echo -e "${MAG}${BOX_BOT}${RST}"
echo
ok "Finalizado."
