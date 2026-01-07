#!/bin/bash
# ============================================================
#   KING•VPN — error.sh (DIAGNÓSTICO AVANZADO, SIN SPAM)
#   ✔ No detiene procesos
#   ✔ Solo imprime ERRORES + CAUSA + FIX sugerido
#   ✔ Detecta: puertos, PM2, build, prisma, .env, DB path, nginx
#   ✔ Modo deep: ./error.sh --deep  (corre checks más pesados)
# ============================================================

set +e

ROOT="/root/DTunnel"
DEEP=0
[[ "${1:-}" == "--deep" ]] && DEEP=1

# --------------------------
# COLORES
# --------------------------
RST="\033[0m"
DIM="\033[2m"
WHT="\033[1;37m"
GRN="\033[0;32m"
YEL="\033[1;33m"
RED="\033[0;31m"
CYA="\033[0;36m"
MAG="\033[0;35m"

LINE="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

say()  { echo -e "$*"; }
hr()   { say "${MAG}${LINE}${RST}"; }

# --------------------------
# CAPTURA DE ERRORES
# --------------------------
ISSUES=0
ISSUE_LOG=""

add_issue() {
  local title="$1"
  local cause="$2"
  local fix="$3"
  local evidence="${4:-}"

  ISSUES=$((ISSUES+1))
  ISSUE_LOG+=$'\n'
  ISSUE_LOG+="${RED}✖ ERROR #${ISSUES}${RST} ${WHT}${title}${RST}\n"
  ISSUE_LOG+="${YEL}• Causa:${RST} ${cause}\n"
  [[ -n "$fix" ]] && ISSUE_LOG+="${CYA}• Fix:${RST} ${fix}\n"
  [[ -n "$evidence" ]] && ISSUE_LOG+="${DIM}• Evidencia:${RST} ${evidence}\n"
}

ok_banner() {
  say "${GRN}✔ No se detectaron fallas críticas.${RST}"
  say "${DIM}Si igual algo falla en UI/CSRF, corré: ./error.sh --deep${RST}"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

safe_grep_env() {
  local key="$1"
  [[ -f "$ROOT/.env" ]] || return 1
  grep -E "^${key}=" "$ROOT/.env" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '\r'
}

port_owner() {
  local p="$1"
  # devuelve: "pid cmdline"
  local out
  out="$(ss -lptn "sport = :$p" 2>/dev/null | tail -n +2)"
  if [[ -z "$out" ]]; then
    echo ""
    return 0
  fi
  # extraer pid y proceso si está
  local pid
  pid="$(echo "$out" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n1)"
  if [[ -n "$pid" ]]; then
    local cmd
    cmd="$(ps -p "$pid" -o cmd= 2>/dev/null | head -n1)"
    echo "$pid $cmd"
  else
    echo "unknown $out"
  fi
}

# --------------------------
# HEADER
# --------------------------
clear >/dev/null 2>&1 || true
hr
say "${MAG}KING•VPN${RST}  ${WHT}Diagnóstico de DTunnel (error.sh)${RST}"
say "${DIM}Ruta: ${ROOT} | Modo: $([[ $DEEP -eq 1 ]] && echo DEEP || echo NORMAL)${RST}"
hr

# --------------------------
# 0) Ruta proyecto
# --------------------------
if [[ ! -d "$ROOT" ]]; then
  add_issue "Proyecto no encontrado" "No existe ${ROOT}" "Andá a /root y cloná/ubicá DTunnel en /root/DTunnel" ""
fi

# --------------------------
# 1) Binarios mínimos
# --------------------------
if ! need_cmd node; then
  add_issue "Node.js faltante" "node no está instalado" "Instalá Node 18 (o el requerido por tu panel)" "command -v node = vacío"
else
  NODEV="$(node -v 2>/dev/null)"
  # recomendado Node 18.x (vos estás en 18.20.x)
  if [[ "$NODEV" != v18* ]]; then
    add_issue "Versión de Node no recomendada" "Detectado ${NODEV}" "Usá Node 18.x para evitar problemas con dependencias" "node -v = ${NODEV}"
  fi
fi

if ! need_cmd npm; then
  add_issue "NPM faltante" "npm no está instalado" "Reinstalá nodejs (incluye npm) o instalá npm" "command -v npm = vacío"
fi

# PM2 no es obligatorio, pero si usás procesos, sí
if ! need_cmd pm2; then
  add_issue "PM2 faltante" "pm2 no está instalado" "npm i -g pm2" "command -v pm2 = vacío"
fi

# --------------------------
# 2) .env y variables clave
# --------------------------
if [[ ! -f "$ROOT/.env" ]]; then
  add_issue ".env faltante" "No existe ${ROOT}/.env" "Crealo con PORT, DATABASE_URL, CSRF_SECRET, JWT_SECRET_KEY, JWT_SECRET_REFRESH" ""
else
  PORT="$(safe_grep_env PORT)"
  DB_URL="$(safe_grep_env DATABASE_URL)"
  CSRF_SECRET="$(safe_grep_env CSRF_SECRET)"
  JWTK="$(safe_grep_env JWT_SECRET_KEY)"
  JWTR="$(safe_grep_env JWT_SECRET_REFRESH)"

  [[ -z "$PORT" ]] && add_issue "PORT no definido" "Falta PORT en .env" "Agregá: PORT=8080 (o el puerto que uses)" ""
  [[ -z "$DB_URL" ]] && add_issue "DATABASE_URL no definido" "Falta DATABASE_URL en .env" "Agregá: DATABASE_URL=file:./prisma/database.db (recomendado en tu caso)" ""
  [[ -z "$CSRF_SECRET" ]] && add_issue "CSRF_SECRET no definido" "Falta CSRF_SECRET en .env" "Agregá un secreto random (openssl rand -hex 16)" ""
  [[ -z "$JWTK" ]] && add_issue "JWT_SECRET_KEY no definido" "Falta JWT_SECRET_KEY en .env" "Agregá un secreto random (openssl rand -hex 32)" ""
  [[ -z "$JWTR" ]] && add_issue "JWT_SECRET_REFRESH no definido" "Falta JWT_SECRET_REFRESH en .env" "Agregá un secreto random (openssl rand -hex 32)" ""
fi

# --------------------------
# 3) Prisma + DB (TU CASO: DB en /prisma/database.db)
# --------------------------
if [[ ! -f "$ROOT/prisma/schema.prisma" ]]; then
  add_issue "Prisma schema faltante" "No existe $ROOT/prisma/schema.prisma" "Verificá que el repo esté completo" ""
fi

DB1="$ROOT/database.db"
DB2="$ROOT/prisma/database.db"

if [[ ! -f "$DB1" && ! -f "$DB2" ]]; then
  add_issue "database.db faltante" "No existe ni $DB1 ni $DB2" "Tu DB debería existir en: $DB2 (según tu servidor)" ""
else
  # Si existe en prisma pero env apunta a ./database.db -> inconsistencia
  if [[ -f "$DB2" && -f "$ROOT/.env" ]]; then
    DB_URL="$(safe_grep_env DATABASE_URL)"
    if [[ "$DB_URL" == "file:./database.db" && ! -f "$DB1" ]]; then
      add_issue "DATABASE_URL apunta a ruta incorrecta" \
        "DATABASE_URL=file:./database.db pero la DB real está en prisma/database.db" \
        "Cambiá en .env: DATABASE_URL=file:./prisma/database.db  (y reiniciá el panel)" \
        "DB real: $DB2"
    fi
  fi

  # Si existe en raíz pero env apunta a prisma -> inconsistencia
  if [[ -f "$DB1" && -f "$ROOT/.env" ]]; then
    DB_URL="$(safe_grep_env DATABASE_URL)"
    if [[ "$DB_URL" == "file:./prisma/database.db" && ! -f "$DB2" ]]; then
      add_issue "DATABASE_URL apunta a ruta incorrecta" \
        "DATABASE_URL=file:./prisma/database.db pero la DB real está en /root/DTunnel/database.db" \
        "Cambiá en .env: DATABASE_URL=file:./database.db  (y reiniciá el panel)" \
        "DB real: $DB1"
    fi
  fi
fi

# --------------------------
# 4) Build output esperado
# --------------------------
if [[ ! -f "$ROOT/package.json" ]]; then
  add_issue "package.json faltante" "No existe $ROOT/package.json" "El proyecto está incompleto o estás en otra carpeta" ""
fi

if [[ ! -f "$ROOT/tsconfig.json" ]]; then
  add_issue "tsconfig.json faltante" "No existe $ROOT/tsconfig.json" "Sin tsconfig, tsc --build no funciona" ""
fi

if [[ ! -d "$ROOT/node_modules" ]]; then
  add_issue "node_modules faltante" "No existe $ROOT/node_modules" "Ejecutá: cd $ROOT && npm install" ""
fi

if [[ ! -f "$ROOT/build/index.js" ]]; then
  add_issue "Build faltante" "No existe $ROOT/build/index.js" "Ejecutá: cd $ROOT && npm run build" ""
fi

# --------------------------
# 5) Puerto (causa #1 de tu caso real)
# --------------------------
PORT_TO_CHECK="8080"
[[ -f "$ROOT/.env" ]] && PORT_TO_CHECK="$(safe_grep_env PORT | sed 's/[^0-9]//g')"
[[ -z "$PORT_TO_CHECK" ]] && PORT_TO_CHECK="8080"

OWNER="$(port_owner "$PORT_TO_CHECK")"
if [[ -n "$OWNER" ]]; then
  add_issue "Puerto ocupado (EADDRINUSE)" \
    "El puerto ${PORT_TO_CHECK} está en uso, el panel que intente escuchar ahí va a fallar" \
    "Solución rápida (si es duplicado): pm2 delete panelweb  | Alternativa: levantar panelweb con PORT distinto (ej 8081)" \
    "Owner: $OWNER"
fi

# --------------------------
# 6) PM2 salud general (errored + logs cortos)
# --------------------------
if need_cmd pm2; then
  PM2_LIST="$(pm2 jlist 2>/dev/null)"
  if [[ -z "$PM2_LIST" ]]; then
    # pm2 instalado pero sin daemon
    pm2 ping >/dev/null 2>&1
    PM2_LIST="$(pm2 jlist 2>/dev/null)"
  fi

  # detectar procesos "errored"
  if echo "$PM2_LIST" | grep -q '"status":"errored"'; then
    # listar nombres errored (simple)
    ERRORED_NAMES="$(pm2 list 2>/dev/null | awk '/errored/{print $2}' | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g')"
    add_issue "PM2 con procesos en error" \
      "Hay procesos PM2 en estado 'errored': ${ERRORED_NAMES:-desconocido}" \
      "Mirar log del proceso: pm2 logs <nombre> --lines 80" \
      ""
  fi

  # caso típico tuyo: panelweb duplicado
  if pm2 list 2>/dev/null | awk '{print $2}' | grep -qx "panelweb"; then
    # si además existe kingvpn-panel, marcar posible duplicado
    if pm2 list 2>/dev/null | awk '{print $2}' | grep -qx "kingvpn-panel"; then
      add_issue "Posible duplicado de panel en PM2" \
        "Están 'kingvpn-panel' y 'panelweb'. Si ambos usan el mismo PORT => EADDRINUSE" \
        "Recomendado: dejá SOLO uno. Ej: pm2 delete panelweb  (si no lo usás)" \
        "pm2 list muestra ambos"
    fi
  fi
fi

# --------------------------
# 7) Nginx config
# --------------------------
if need_cmd nginx; then
  nginx -t >/dev/null 2>&1
  if [[ $? -ne 0 ]]; then
    add_issue "Nginx con configuración inválida" \
      "nginx -t falla" \
      "Corrigí /etc/nginx/nginx.conf o sites-enabled. Corré: nginx -t para ver el detalle" \
      ""
  fi
fi

# --------------------------
# 8) CSRF: chequeo estático (avisa si el front NO manda token)
#     (No “adivina” runtime, pero detecta causas comunes)
# --------------------------
# si tu middleware requiere header 'csrf-token', pero form POST clásico no lo manda,
# entonces register.js debe interceptar y enviar fetch con header.
REG_JS="$ROOT/frontend/public/static/js/register.js"
if [[ -f "$REG_JS" ]]; then
  if ! grep -qi "csrf-token" "$REG_JS"; then
    add_issue "Registro puede fallar por CSRF" \
      "El middleware espera 'csrf-token' (header/body), pero register.js no parece enviar csrf-token en header" \
      "Solución: en register.js enviar header 'csrf-token': getCsrfTokenHead() o incluir body csrf_token y que middleware lo acepte" \
      "Archivo: $REG_JS (no contiene 'csrf-token')"
  fi
else
  # si no existe, el front puede estar en otra ruta, pero avisamos leve
  # (no lo marcamos como error crítico si tu panel no usa esa ruta)
  :
fi

# --------------------------
# 9) Modo DEEP: corre checks más pesados pero con salida controlada
# --------------------------
if [[ $DEEP -eq 1 ]]; then
  # Prisma validate
  if [[ -f "$ROOT/prisma/schema.prisma" && -d "$ROOT/node_modules" ]]; then
    out="$(cd "$ROOT" && npx prisma validate 2>&1)"
    if [[ $? -ne 0 ]]; then
      add_issue "Prisma validate falló" \
        "El schema no valida" \
        "Revisá prisma/schema.prisma y corré npx prisma format" \
        "$(echo "$out" | tail -n 6 | tr '\n' ' ')"
    fi
  fi

  # Build tsc
  if [[ -f "$ROOT/package.json" && -d "$ROOT/node_modules" ]]; then
    out="$(cd "$ROOT" && npm run -s build 2>&1)"
    if [[ $? -ne 0 ]]; then
      add_issue "Build TypeScript falló" \
        "tsc --build está fallando" \
        "Abrí el error exacto que muestra el compilador y arreglá ese archivo" \
        "$(echo "$out" | tail -n 12 | tr '\n' ' ')"
    fi
  fi

  # Start smoke test (NO corre server si está ocupado, solo detecta EADDRINUSE y otros)
  if [[ -f "$ROOT/build/index.js" ]]; then
    out="$(cd "$ROOT" && node build/index.js 2>&1 >/dev/null)"
    # si devuelve algo tipo EADDRINUSE o crash, lo capturamos
    if echo "$out" | grep -qi "EADDRINUSE"; then
      add_issue "Start falló (EADDRINUSE)" \
        "El panel no pudo iniciar porque el puerto ya está en uso" \
        "Liberá el puerto o cambiá PORT del proceso duplicado" \
        "$(echo "$out" | grep -i "EADDRINUSE" | head -n1)"
    elif [[ -n "$out" ]]; then
      # cualquier otra traza
      add_issue "Start falló" \
        "El panel arrojó un error al iniciar" \
        "Revisá el stacktrace y el módulo que falla" \
        "$(echo "$out" | tail -n 10 | tr '\n' ' ')"
    fi
  fi
fi

# --------------------------
# OUTPUT FINAL (SIN SPAM)
# --------------------------
if [[ $ISSUES -eq 0 ]]; then
  ok_banner
else
  say "$ISSUE_LOG"
  hr
  say "${WHT}Resumen:${RST} ${RED}${ISSUES}${RST} problema(s) detectado(s)."
  say "${DIM}Tip: si querés chequeos más duros: ./error.sh --deep${RST}"
fi
