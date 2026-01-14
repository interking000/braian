#!/bin/bash
# ============================================================
#   KING•VPN — INSTALADOR COMPLETO DTunnel (LIMPIO + PERSONALIZADO)
#   ✅ Pregunta TODO lo importante (sin defaults)
#   ✅ Genera .env correcto (DB ABSOLUTA para evitar DB fantasma)
#   ✅ Prisma: crea DB real (si queda 0 bytes -> force-reset)
#   ✅ Instala Mercado Pago deps (SDK opcional) + sharp (con libvips)
#   ✅ Genera SSL con TU dominio (CN = tu dominio)
#   ✅ Configura NGINX con TU dominio + TU puerto
#   ✅ Muestra tabla .tables al final (verificación)
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

# --------------------------
# MAIN
# --------------------------
need_root
clear || true
title "Instalador KING•VPN — DTunnel"
echo -e "${DIM}Sin defaults en dominio/puerto/tokens. Todo se carga limpio.${RST}"
echo

PROJECT_DIR="/root/DTunnel"
NGINX_DIR="$PROJECT_DIR/nginx"
ENV_FILE="$PROJECT_DIR/.env"
NGINX_CONF="/etc/nginx/sites-available/dtunnel.conf"

mkdir -p "$PROJECT_DIR" "$NGINX_DIR"

title "CONFIGURACIÓN OBLIGATORIA"

PANEL_PORT="$(ask_port)"
PANEL_DOMAIN="$(ask_domain)"
APP_BASE_URL="$(ask_url)"
MP_ACCESS_TOKEN="$(ask_required "Pegá tu Access Token de Mercado Pago (sin << >>)")"

echo
ok "Puerto: $PANEL_PORT"
ok "Dominio: $PANEL_DOMAIN"
ok "APP_BASE_URL: $APP_BASE_URL"
ok "MP_ACCESS_TOKEN: (cargado)"

echo
title "INSTALANDO DEPENDENCIAS"

step "Actualizando sistema..."
apt update -y
apt upgrade -y

step "Instalando dependencias base..."
apt install -y \
  curl \
  build-essential \
  openssl \
  git \
  unzip \
  zip \
  ca-certificates \
  software-properties-common \
  nginx \
  ufw \
  sqlite3 \
  pkg-config

# deps para sharp (libvips) — evita que falle compilación
step "Instalando dependencias para Sharp (libvips)..."
apt install -y \
  libvips \
  libvips-dev

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

# Java (opcional)
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
  echo -e "${YEL}Subí/cloná tu repo DTunnel en ${WHT}$PROJECT_DIR${YEL} y volvé a correr este install.${RST}"
  exit 1
fi

cd "$PROJECT_DIR"

step "Instalando dependencias del proyecto (npm install)..."
npm install

step "Instalando dependencias adicionales (Mercado Pago + Sharp)..."
# SDK mercadopago es opcional (tu código actual usa fetch). Igual lo dejo instalado.
npm install mercadopago sharp --save || npm install sharp --save

step "Generando archivo .env (LIMPIO)..."

# ✅ CAMBIO CLAVE: DB ABSOLUTA (evita 'DB fantasma' por cwd/pm2)
DATABASE_PATH="file:${PROJECT_DIR}/prisma/database.db"

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

# (Opcional recomendado) Webhook signature secret
MP_WEBHOOK_SECRET=
EOF

ok ".env generado en $ENV_FILE"

# Prisma
if [ ! -d "$PROJECT_DIR/prisma" ]; then
  warn "No existe carpeta prisma/ en el proyecto."
  exit 1
fi

# ✅ asegurar archivo DB
step "Asegurando archivo DB: $PROJECT_DIR/prisma/database.db"
mkdir -p "$PROJECT_DIR/prisma"
touch "$PROJECT_DIR/prisma/database.db"
chmod 600 "$PROJECT_DIR/prisma/database.db" || true

DB_FILE="$PROJECT_DIR/prisma/database.db"
DB_SIZE="$(stat -c%s "$DB_FILE" 2>/dev/null || echo 0)"

# ✅ si está vacía (0 bytes), forzamos reset (porque no hay nada útil)
if [ "$DB_SIZE" -eq 0 ]; then
  warn "database.db está vacía (0 bytes). Creando tablas con Prisma (--force-reset)..."
  npx prisma db push --force-reset
else
  step "Prisma: sincronizando base de datos..."
  npx prisma db push
fi

step "Prisma: generando client..."
npx prisma generate

step "Build: npm run build"
npm run build

echo
title "SSL + NGINX (CON TU DOMINIO)"

# SSL
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
if [ -e /etc/nginx/sites-enabled/default ]; then
  rm -f /etc/nginx/sites-enabled/default
fi

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
  pm2 start "$PROJECT_DIR/ecosystem.config.js" --update-env || pm2 restart kingvpn-panel --update-env || true
  pm2 save || true
  ok "PM2 iniciado"
elif [ -f "$PROJECT_DIR/start.sh" ]; then
  step "start.sh detectado. Dándole permisos y ejecutando..."
  chmod +x "$PROJECT_DIR/start.sh"
  "$PROJECT_DIR/start.sh" || true
  ok "start.sh ejecutado"
else
  warn "No encontré ecosystem.config.js ni start.sh. Iniciá tu panel manualmente."
fi

echo
title "VERIFICACIÓN FINAL (DB + TABLAS)"

step "DB file:"
ls -la "$PROJECT_DIR/prisma/database.db" || true

step "Tablas SQLite:"
sqlite3 "$PROJECT_DIR/prisma/database.db" ".tables" || true

echo
title "FINALIZADO"
echo -e "${BOX_MID} ${GRN}✔${RST} Proyecto:              ${WHT}$PROJECT_DIR${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} .env:                  ${WHT}$ENV_FILE${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Prisma DB:             ${WHT}$PROJECT_DIR/prisma/database.db${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Dominio:               ${WHT}$PANEL_DOMAIN${RST}"
echo -e "${BOX_MID} ${GRN}✔${RST} Puerto interno:        ${WHT}$PANEL_PORT${RST}"
echo -e "${BOX_MID} ${CYA}➜${RST} Logs PM2:              ${WHT}pm2 logs${RST}"
echo -e "${MAG}${BOX_BOT}${RST}"
echo
ok "Listo."

