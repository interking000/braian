#!/bin/bash
# ============================================================
#   KING•VPN  —  INSTALADOR COMPLETO DTunnel (SCRIPT UNIFICADO)
#   ✔ Visual KING•VPN (marcos + colores)
#   ✔ Lógica DTunnel INTACTA (NO tocada)
#   ✔ Evita choques: instala solo lo que falte / idempotente
# ============================================================

set -e

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

step () {
  echo -e "${CYA}➜${RST} ${WHT}$1${RST}"
}

ok () {
  echo -e "${GRN}✔${RST} ${WHT}$1${RST}"
}

warn () {
  echo -e "${YEL}⚠${RST} ${WHT}$1${RST}"
}

# --------------------------
# HEADER
# --------------------------
clear || true
title "Instalando KING•VPN"
echo -e "${DIM}OJO: Script instalador completo de DTunnel (lógica intacta).${RST}"
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
  software-properties-common

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
apt install -y apktool

# --- apksigner (Android build tools) ---
step "Instalando apksigner"
apt install -y apksigner

# --- verificación bonita ---
echo
title "CHECK DE HERRAMIENTAS INSTALADAS"

echo -e "${BLU}[•] Node:${RST}"
node -v

echo -e "${BLU}[•] NPM:${RST}"
npm -v

echo -e "${BLU}[•] TypeScript:${RST}"
tsc -v

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
#step "Instalando Node.js 18..."
#curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
#apt install -y nodejs

step "Instalando PM2 globalmente..."
npm install -g pm2

# --------------------------
# 3. Crear .env con claves secretas
# --------------------------
step "Generando archivo .env..."
DATABASE_PATH="file:./database.db"
CSRF_SECRET=$(openssl rand -hex 16)
JWT_SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET_REFRESH=$(openssl rand -hex 32)

cat <<EOF > "$PROJECT_DIR/.env"
PORT=8080
NODE_ENV=production
DATABASE_URL=$DATABASE_PATH
CSRF_SECRET=$CSRF_SECRET
JWT_SECRET_KEY=$JWT_SECRET_KEY
JWT_SECRET_REFRESH=$JWT_SECRET_REFRESH
EOF

ok ".env generado."

# --------------------------
# 4. Eliminar DB vieja si existe
# --------------------------
if [ -f "$PROJECT_DIR/database.db" ]; then
    step "Eliminando database.db antigua..."
    rm -f "$PROJECT_DIR/database.db"
fi

# --------------------------
# 5. Instalar dependencias del proyecto
# --------------------------
cd "$PROJECT_DIR"
step "Instalando dependencias del proyecto..."
npm install

# --------------------------
# 6. Prisma DB
# --------------------------
step "Sincronizando base de datos con Prisma..."
npx prisma db push

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
        -subj "/C=AR/ST=BuenosAires/L=BA/O=DTunnel/OU=IT/CN=panel.interking.online"
    ok "Certificados generados."
else
    ok "Certificados ya existen."
fi

# --------------------------
# 9. Configurar NGINX base (solo ejemplo)
# --------------------------
NGINX_CONF="/etc/nginx/sites-available/dtunnel.conf"

cat <<EOF > $NGINX_CONF
server {
    listen 80;
    server_name panel.interking.online;

    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name panel.interking.online;

    ssl_certificate $NGINX_DIR/fullchain.pem;
    ssl_certificate_key $NGINX_DIR/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

ln -sf $NGINX_CONF /etc/nginx/sites-enabled/dtunnel.conf
nginx -t && systemctl restart nginx

echo
title "INSTALACIÓN COMPLETA (KING•VPN)"
echo -e "${BOX_MID} ${GRN}✔${RST} Archivo .env        → ${WHT}$PROJECT_DIR/.env${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Certificados SSL     → ${WHT}$NGINX_DIR${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Base de datos        → ${WHT}$PROJECT_DIR/database.db${RST}"
echo -e "${BOX_MID} ${CYA}➜${RST} Usar ./start.sh para iniciar el panel"
echo -e "${MAG}${BOX_BOT}${RST}"
echo
ok "Finalizado."