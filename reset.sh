#!/usr/bin/env bash
# ============================================================
# KINGVPN / DTunnel — reset interactivo
# 1) SEGURO: NO borra DB, NO borra node_modules
# 2) COMPLETO: borra TODO (node_modules, lock, build, DB, etc.)
# ============================================================

set -euo pipefail

PROJECT_DIR="/root/DTunnel"
ENV_FILE="$PROJECT_DIR/.env"
DEFAULT_APP_NAME="kingvpn-panel"

# --------------------------
# UI helpers
# --------------------------
log()  { echo -e "\033[1;36m➜\033[0m \033[1;37m$*\033[0m"; }
ok()   { echo -e "\033[0;32m✔\033[0m \033[1;37m$*\033[0m"; }
warn() { echo -e "\033[1;33m⚠\033[0m \033[1;37m$*\033[0m"; }
die()  { echo -e "\033[0;31m✖\033[0m \033[1;37m$*\033[0m"; exit 1; }

pause() { read -r -p "Presioná ENTER para continuar..." _; }

# --------------------------
# Guards
# --------------------------
[ -d "$PROJECT_DIR" ] || die "No existe $PROJECT_DIR"
cd "$PROJECT_DIR"

# --------------------------
# Cargar .env si existe
# --------------------------
if [ -f "$ENV_FILE" ]; then
  log "Cargando .env"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  ok ".env cargado"
else
  warn "No existe .env → uso valores por defecto"
fi

APP_NAME="${PM2_APP_NAME:-$DEFAULT_APP_NAME}"
PORT="${PORT:-8080}"

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  die "PORT inválido: $PORT"
fi

DB_FILE="$PROJECT_DIR/prisma/database.db"
SCHEMA_FILE="$PROJECT_DIR/prisma/schema.prisma"

# --------------------------
# Common tasks
# --------------------------
stop_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
      log "PM2: stop + delete $APP_NAME"
      pm2 stop "$APP_NAME" >/dev/null 2>&1 || true
      pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
      ok "PM2 limpiado"
    else
      warn "PM2: no existe proceso $APP_NAME"
    fi
  else
    warn "PM2 no instalado"
  fi
}

free_port() {
  log "Liberando puerto $PORT (si hay algo escuchando)"
  local pids=""
  if command -v ss >/dev/null 2>&1; then
    pids="$(ss -lntp 2>/dev/null \
      | awk -v p=":$PORT" '$4 ~ p {print $0}' \
      | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' \
      | sort -u || true)"
  elif command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  else
    warn "No tengo ss ni lsof → no puedo detectar proceso por puerto"
  fi

  if [ -n "${pids:-}" ]; then
    for pid in $pids; do
      warn "Matando PID $pid en puerto $PORT"
      kill -TERM "$pid" 2>/dev/null || true
    done
    sleep 1
    for pid in $pids; do
      kill -KILL "$pid" 2>/dev/null || true
    done
    ok "Puerto $PORT liberado"
  else
    ok "Puerto $PORT ya estaba libre"
  fi
}

clean_logs() {
  log "Limpiando logs (PM2 / nginx / journal)"
  if command -v pm2 >/dev/null 2>&1; then
    pm2 flush >/dev/null 2>&1 || true
  fi
  if [ -d /var/log/nginx ]; then
    : > /var/log/nginx/access.log 2>/dev/null || true
    : > /var/log/nginx/error.log  2>/dev/null || true
  fi
  if command -v journalctl >/dev/null 2>&1; then
    journalctl --rotate >/dev/null 2>&1 || true
    journalctl --vacuum-time=2d >/dev/null 2>&1 || true
  fi
  ok "Logs limpiados"
}

nginx_restart() {
  if command -v nginx >/dev/null 2>&1; then
    log "NGINX: test + restart"
    nginx -t >/dev/null
    systemctl restart nginx
    ok "nginx OK"
  else
    warn "NGINX no instalado"
  fi
}

drop_caches() {
  log "Liberando caches de RAM (drop_caches)"
  sync || true
  if [ -w /proc/sys/vm/drop_caches ]; then
    echo 3 > /proc/sys/vm/drop_caches || true
    ok "RAM cache liberada"
  else
    warn "No puedo escribir drop_caches (permiso/kernel)."
  fi
}

prisma_push() {
  if [ -f "$SCHEMA_FILE" ]; then
    log "Prisma: db push"
    npx prisma db push
    ok "Prisma OK"
  else
    warn "No veo prisma/schema.prisma → salto db push"
  fi
}

do_build_if_exists() {
  if node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts.build?0:1)" >/dev/null 2>&1; then
    log "Build: npm run build"
    npm run build
    ok "Build aplicado"
  else
    warn "No hay script build en package.json → no build"
  fi
}

ensure_deps_safe() {
  # Reset seguro: NO borra node_modules, solo instala si falta
  if [ ! -d node_modules ]; then
    log "node_modules no existe → npm install"
    npm install
    ok "Dependencias instaladas"
  else
    ok "node_modules OK (no se reinstala)"
  fi
  log "Limpiando cache npm"
  npm cache clean --force >/dev/null 2>&1 || true
  ok "npm cache limpio"
}

reinstall_deps_full() {
  log "Instalando dependencias desde cero"
  npm cache clean --force >/dev/null 2>&1 || true
  npm install
  ok "Dependencias instaladas (full)"
}

# --------------------------
# Reset modes
# --------------------------
reset_safe() {
  log "Modo: RESET SEGURO (NO borra DB, NO borra node_modules)"

  stop_pm2
  free_port

  log "Limpiando builds/caches (SIN tocar prisma/)"
  rm -rf \
    .parcel-cache .next dist build out public/build \
    frontend/dist frontend/build frontend/.cache .cache tmp \
    2>/dev/null || true
  rm -rf /tmp/dtunnel* /tmp/kingvpn* 2>/dev/null || true
  ok "Caches/builds limpiados"

  clean_logs
  ensure_deps_safe
  prisma_push
  do_build_if_exists
  nginx_restart
  drop_caches

  echo
  ok "RESET SEGURO listo ✅"
  echo "Ahora ejecutá:  $PROJECT_DIR/start.sh"
}

reset_full() {
  log "Modo: RESET COMPLETO (BORRA TODO: deps, build, DB)"

  stop_pm2
  free_port
  clean_logs

  # Seguridad: confirmar path correcto
  [ "$(pwd)" = "$PROJECT_DIR" ] || die "No estoy en $PROJECT_DIR, aborto por seguridad"

  warn "ESTO VA A BORRAR:"
  warn " - node_modules/"
  warn " - package-lock.json (si existe)"
  warn " - build/, dist/, .cache, etc."
  warn " - DB: prisma/database.db"
  echo

  read -r -p "Escribí BORRAR para confirmar: " confirm1
  [ "$confirm1" = "BORRAR" ] || die "Cancelado."

  read -r -p "Última confirmación: escribí BORRAR TODO: " confirm2
  [ "$confirm2" = "BORRAR TODO" ] || die "Cancelado."

  log "Borrando dependencias y builds..."
  rm -rf node_modules
  rm -f package-lock.json
  rm -rf \
    .parcel-cache .next dist build out public/build \
    frontend/dist frontend/build frontend/.cache .cache tmp \
    2>/dev/null || true
  rm -rf /tmp/dtunnel* /tmp/kingvpn* 2>/dev/null || true
  ok "Deps + builds borrados"

  log "Borrando DB..."
  rm -f "$DB_FILE" || true
  ok "DB borrada: $DB_FILE"

  reinstall_deps_full
  prisma_push
  do_build_if_exists
  nginx_restart
  drop_caches

  echo
  ok "RESET COMPLETO listo ✅"
  echo "Ahora ejecutá:  $PROJECT_DIR/start.sh"
}

# --------------------------
# Menu
# --------------------------
clear || true
echo "=============================================="
echo " KINGVPN / DTunnel — RESET INTERACTIVO"
echo "=============================================="
echo "Proyecto: $PROJECT_DIR"
echo "PM2 App : $APP_NAME"
echo "Port    : $PORT"
echo "DB      : $DB_FILE"
echo "----------------------------------------------"
echo "1) Reset SEGURO  (no borra DB, no borra deps)"
echo "2) Reset COMPLETO (borra TODO: deps + DB + build)"
echo "0) Salir"
echo "----------------------------------------------"

read -r -p "Elegí una opción [1/2/0]: " opt

case "${opt:-}" in
  1) reset_safe ;;
  2) reset_full ;;
  0) echo "Saliendo."; exit 0 ;;
  *) die "Opción inválida" ;;
esac
