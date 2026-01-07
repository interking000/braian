#!/usr/bin/env bash
# KINGVPN / DTunnel - reset seguro (NO borra database.db)
set -euo pipefail

PROJECT_DIR="/root/DTunnel"
APP_NAME="kingvpn-panel"

log()  { echo -e "\033[1;36m➜\033[0m \033[1;37m$*\033[0m"; }
ok()   { echo -e "\033[0;32m✔\033[0m \033[1;37m$*\033[0m"; }
warn() { echo -e "\033[1;33m⚠\033[0m \033[1;37m$*\033[0m"; }

[ -d "$PROJECT_DIR" ] || { echo "No existe $PROJECT_DIR"; exit 1; }
cd "$PROJECT_DIR"

log "Reset DTunnel/KINGVPN (sin tocar database.db)"

# 1) Parar procesos viejos (PM2)
if command -v pm2 >/dev/null 2>&1; then
  if pm2 jlist | grep -q "\"name\":\"$APP_NAME\""; then
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

# 2) Liberar el puerto 8080 (mata lo que lo esté usando)
PORT="${PORT:-8080}"
log "Liberando puerto $PORT (si hay algo escuchando)"
if command -v ss >/dev/null 2>&1; then
  PIDS="$(ss -lntp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {print $0}' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u)"
else
  PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
fi

if [ -n "${PIDS:-}" ]; then
  for pid in $PIDS; do
    warn "Matando PID $pid en puerto $PORT"
    kill -TERM "$pid" 2>/dev/null || true
  done
  sleep 1
  for pid in $PIDS; do
    kill -KILL "$pid" 2>/dev/null || true
  done
  ok "Puerto $PORT liberado"
else
  ok "Puerto $PORT ya estaba libre"
fi

# 3) Limpiar caches del frontend/build (para que no cargue viejo)
#    OJO: NO tocamos database.db
log "Limpiando builds/caches del panel (frontend) sin tocar DB"
rm -rf \
  .parcel-cache \
  .next \
  dist \
  build \
  out \
  public/build \
  frontend/dist \
  frontend/build \
  frontend/.cache \
  .cache \
  tmp \
  /tmp/dtunnel* \
  /tmp/kingvpn* \
  2>/dev/null || true
ok "Caches/builds limpiados"

# 4) Limpiar cache de node (sin borrar node_modules, más rápido)
log "Limpiando cache de npm"
npm cache clean --force >/dev/null 2>&1 || true
ok "npm cache limpio"

# 5) Rotar / truncar logs (PM2 + systemd + nginx)
log "Limpiando logs (sin borrar configs)"
# PM2 logs
if command -v pm2 >/dev/null 2>&1; then
  pm2 flush >/dev/null 2>&1 || true
fi

# nginx logs (si existe)
if [ -d /var/log/nginx ]; then
  : > /var/log/nginx/access.log 2>/dev/null || true
  : > /var/log/nginx/error.log  2>/dev/null || true
fi

# journal (si systemd)
if command -v journalctl >/dev/null 2>&1; then
  journalctl --rotate >/dev/null 2>&1 || true
  # reduce lo viejo sin romper nada
  journalctl --vacuum-time=2d >/dev/null 2>&1 || true
fi
ok "Logs limpiados"

# 6) Reinstalar deps SOLO si hace falta (sin tocar DB)
if [ ! -d node_modules ]; then
  log "node_modules no existe → npm install"
  npm install
  ok "Dependencias instaladas"
else
  ok "node_modules OK (no se reinstala)"
fi

# 7) Prisma db push (mantiene database.db, solo aplica schema)
if [ -f "prisma/schema.prisma" ]; then
  log "Prisma: db push (NO borra DB)"
  npx prisma db push >/dev/null || true
  ok "Prisma OK"
else
  warn "No veo prisma/schema.prisma → salto db push"
fi

# 8) Rebuild para aplicar cambios del frontend/panel
#    (esto es lo que evita que “cargue lo viejo”)
if node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts.build?0:1)" >/dev/null 2>&1; then
  log "Rebuild: npm run build"
  npm run build
  ok "Build aplicado"
else
  warn "No hay script build en package.json → no rebuild"
fi

# 9) Reiniciar nginx
if command -v nginx >/dev/null 2>&1; then
  log "Reiniciando nginx"
  nginx -t >/dev/null
  systemctl restart nginx
  ok "nginx OK"
fi

# 10) Liberar caches de RAM (opcional)
log "Liberando caches de RAM (drop_caches)"
sync || true
if [ -w /proc/sys/vm/drop_caches ]; then
  echo 3 > /proc/sys/vm/drop_caches || true
  ok "RAM cache liberada"
else
  warn "No puedo escribir drop_caches (permiso/kernel)."
fi

echo
ok "RESET listo ✅"
echo "Ahora ejecutá:  /root/DTunnel/start.sh"
