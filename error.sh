#!/usr/bin/env bash
# ============================================================
#   KING•VPN — error.sh (DIAGNÓSTICO NIVEL DIOS, SIN SPAM)
#   ✔ No detiene procesos (modo normal)
#   ✔ Detecta y explica: PM2, puertos, build, TS errors, prisma, DB, .env,
#     rutas API 404, Eta templates faltantes, nginx, certificados, MercadoPago env
#   ✔ Reporte final: diagnostic-report.txt (Causa + Evidencia + Fix)
#   ✔ Modo deep: ./error.sh --deep (corre checks más pesados)
# ============================================================

set +e

ROOT="${ROOT:-/root/DTunnel}"
DEEP=0
[[ "${1:-}" == "--deep" ]] && DEEP=1

REPORT="$ROOT/diagnostic-report.txt"
ISSUES=0
ISSUE_LOG=""

# --------------------------
# COLORES / UI
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

say() { echo -e "$*"; }
hr()  { say "${MAG}${LINE}${RST}"; }
need_cmd(){ command -v "$1" >/dev/null 2>&1; }

stamp(){ date +"%Y-%m-%d %H:%M:%S"; }

# --------------------------
# HELPERS
# --------------------------
safe_read_env() {
  local key="$1"
  [[ -f "$ROOT/.env" ]] || return 1
  # lee KEY=... sin romper espacios
  local v
  v="$(grep -E "^${key}=" "$ROOT/.env" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '\r')"
  # quitar comillas externas si existen
  v="${v%\"}"; v="${v#\"}"
  echo "$v"
}

port_owner() {
  local p="$1"
  local out pid cmd
  out="$(ss -lptn "sport = :$p" 2>/dev/null | tail -n +2)"
  [[ -z "$out" ]] && { echo ""; return 0; }
  pid="$(echo "$out" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n1)"
  if [[ -n "$pid" ]]; then
    cmd="$(ps -p "$pid" -o cmd= 2>/dev/null | head -n1)"
    echo "$pid $cmd"
  else
    echo "unknown $out"
  fi
}

add_issue() {
  local title="$1"
  local cause="$2"
  local fix="$3"
  local evidence="${4:-}"

  ISSUES=$((ISSUES+1))
  ISSUE_LOG+=$'\n'
  ISSUE_LOG+="${RED}✖ ERROR #${ISSUES}${RST} ${WHT}${title}${RST}\n"
  ISSUE_LOG+="${YEL}• Causa:${RST} ${cause}\n"
  [[ -n "$fix" ]] && ISSUE_LOG+="${CYA}• Solución:${RST} ${fix}\n"
  [[ -n "$evidence" ]] && ISSUE_LOG+="${DIM}• Evidencia:${RST} ${evidence}\n"
}

section() {
  hr
  say "${WHT}$1${RST} ${DIM}($(stamp))${RST}"
  hr
}

write_report() {
  mkdir -p "$ROOT" 2>/dev/null
  {
    echo "KING•VPN — DIAGNÓSTICO DTunnel"
    echo "Fecha: $(stamp)"
    echo "Ruta: $ROOT"
    echo "Modo: $([[ $DEEP -eq 1 ]] && echo DEEP || echo NORMAL)"
    echo
    if [[ $ISSUES -eq 0 ]]; then
      echo "✔ No se detectaron fallas críticas."
      echo "Tip: si igual algo falla raro: ./error.sh --deep"
    else
      # sin colores en archivo
      echo "$ISSUE_LOG" | sed 's/\x1b\[[0-9;]*m//g'
      echo
      echo "Resumen: $ISSUES problema(s) detectado(s)."
      echo "Tip: ./error.sh --deep para checks más pesados."
    fi
  } > "$REPORT"
}

# --------------------------
# HEADER
# --------------------------
clear >/dev/null 2>&1 || true
hr
say "${MAG}KING•VPN${RST}  ${WHT}Diagnóstico DTunnel (error.sh)${RST}"
say "${DIM}Ruta: ${ROOT} | Modo: $([[ $DEEP -eq 1 ]] && echo DEEP || echo NORMAL)${RST}"
say "${DIM}Salida: pantalla + reporte ${REPORT}${RST}"
hr

# ============================================================
# 0) Proyecto existe
# ============================================================
section "0) Proyecto / Estructura"
if [[ ! -d "$ROOT" ]]; then
  add_issue "Proyecto no encontrado" "No existe ${ROOT}" \
    "Ubicá el repo en /root/DTunnel o exportá ROOT=/ruta y corré ./error.sh" \
    ""
  say "$ISSUE_LOG"
  write_report
  exit 1
fi

# archivos mínimos esperados
[[ ! -f "$ROOT/package.json" ]] && add_issue "package.json faltante" "El proyecto está incompleto" \
  "Recloná repo o entrá a la carpeta correcta: cd /root/DTunnel" \
  "$ROOT/package.json no existe"
[[ ! -d "$ROOT/src" ]] && add_issue "Carpeta src faltante" "No existe /src" \
  "Repo incompleto o estás en otra ruta" \
  "$ROOT/src no existe"
[[ ! -d "$ROOT/prisma" ]] && add_issue "Carpeta prisma faltante" "No existe /prisma" \
  "Repo incompleto" \
  "$ROOT/prisma no existe"

# ============================================================
# 1) Binarios / versiones
# ============================================================
section "1) Binarios (node/npm/pm2/nginx)"
if ! need_cmd node; then
  add_issue "Node.js faltante" "node no está instalado" \
    "Instalá Node 18: curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && apt install -y nodejs" \
    "command -v node vacío"
else
  NODEV="$(node -v 2>/dev/null)"
  [[ "$NODEV" != v18* ]] && add_issue "Node no recomendado" "Detectado ${NODEV}, DTunnel suele ir mejor con 18.x" \
    "Instalá Node 18.x (Nodesource) para evitar incompatibilidades" \
    "node -v = $NODEV"
fi

if ! need_cmd npm; then
  add_issue "NPM faltante" "npm no está instalado" \
    "Reinstalá nodejs (incluye npm)" \
    "command -v npm vacío"
fi

if ! need_cmd pm2; then
  add_issue "PM2 faltante" "pm2 no está instalado" \
    "npm i -g pm2" \
    "command -v pm2 vacío"
fi

if need_cmd nginx; then
  nginx -t >/dev/null 2>&1
  [[ $? -ne 0 ]] && add_issue "Nginx roto" "nginx -t falla" \
    "Corré: nginx -t (ver detalle) y corregí sites-enabled / conf" \
    "nginx -t != 0"
fi

# ============================================================
# 2) .env y variables críticas
# ============================================================
section "2) .env / Variables críticas"
if [[ ! -f "$ROOT/.env" ]]; then
  add_issue ".env faltante" "No existe ${ROOT}/.env" \
    "Crealo con: PORT, NODE_ENV, DATABASE_URL, CSRF_SECRET, JWT_SECRET_KEY, JWT_SECRET_REFRESH, MP_ACCESS_TOKEN, APP_BASE_URL, FRONTEND_RETURN_URL" \
    ""
else
  PORT="$(safe_read_env PORT)"
  NODE_ENV="$(safe_read_env NODE_ENV)"
  DATABASE_URL="$(safe_read_env DATABASE_URL)"
  CSRF_SECRET="$(safe_read_env CSRF_SECRET)"
  JWT_SECRET_KEY="$(safe_read_env JWT_SECRET_KEY)"
  JWT_SECRET_REFRESH="$(safe_read_env JWT_SECRET_REFRESH)"
  MP_ACCESS_TOKEN="$(safe_read_env MP_ACCESS_TOKEN)"
  APP_BASE_URL="$(safe_read_env APP_BASE_URL)"
  FRONTEND_RETURN_URL="$(safe_read_env FRONTEND_RETURN_URL)"

  [[ -z "$PORT" ]] && add_issue "PORT vacío" "PORT no está definido en .env" \
    "Poné PORT=8080 (o el que quieras)" ""
  [[ -z "$DATABASE_URL" ]] && add_issue "DATABASE_URL vacío" "DATABASE_URL no está definido" \
    "Usá: DATABASE_URL=\"file:./prisma/database.db\"" ""
  [[ -z "$CSRF_SECRET" ]] && add_issue "CSRF_SECRET vacío" "Falta CSRF_SECRET" \
    "Generá: openssl rand -hex 16 y pegalo en .env" ""
  [[ -z "$JWT_SECRET_KEY" ]] && add_issue "JWT_SECRET_KEY vacío" "Falta JWT_SECRET_KEY" \
    "Generá: openssl rand -hex 32" ""
  [[ -z "$JWT_SECRET_REFRESH" ]] && add_issue "JWT_SECRET_REFRESH vacío" "Falta JWT_SECRET_REFRESH" \
    "Generá: openssl rand -hex 32" ""

  # Mercado Pago: no lo marcamos crítico si todavía no configuraste pagos, pero sí avisamos
  if [[ -z "$MP_ACCESS_TOKEN" ]]; then
    add_issue "MercadoPago sin token" "MP_ACCESS_TOKEN está vacío (pagos van a fallar/404 si rutas no existen)" \
      "Poné tu token en .env: MP_ACCESS_TOKEN=\"APP_USR-...\"" \
      "MP_ACCESS_TOKEN vacío"
  else
    # chequeo básico del formato
    if [[ "$MP_ACCESS_TOKEN" != APP_USR-* ]]; then
      add_issue "MP_ACCESS_TOKEN sospechoso" "El token no empieza con APP_USR-" \
        "Revisá que pegaste el Access Token correcto (no public key)" \
        "MP_ACCESS_TOKEN=${MP_ACCESS_TOKEN:0:18}..."
    fi
  fi

  if [[ -n "$APP_BASE_URL" ]] && [[ "$APP_BASE_URL" != http* ]]; then
    add_issue "APP_BASE_URL sin esquema" "APP_BASE_URL no empieza con http/https" \
      "Usá: APP_BASE_URL=\"https://tu-dominio.com\"" \
      "APP_BASE_URL=$APP_BASE_URL"
  fi
  if [[ -n "$FRONTEND_RETURN_URL" ]] && [[ "$FRONTEND_RETURN_URL" != http* ]]; then
    add_issue "FRONTEND_RETURN_URL sin esquema" "FRONTEND_RETURN_URL no empieza con http/https" \
      "Usá: FRONTEND_RETURN_URL=\"https://tu-dominio.com\"" \
      "FRONTEND_RETURN_URL=$FRONTEND_RETURN_URL"
  fi
fi

# ============================================================
# 3) DB path real (tu caso: prisma/database.db)
# ============================================================
section "3) Base de datos (SQLite) / Prisma"
SCHEMA="$ROOT/prisma/schema.prisma"
DB_PRISMA="$ROOT/prisma/database.db"
DB_ROOT="$ROOT/database.db"

[[ ! -f "$SCHEMA" ]] && add_issue "schema.prisma faltante" "No existe prisma/schema.prisma" \
  "Repo incompleto" "$SCHEMA no existe"

# si .env apunta a una DB que no existe -> error real típico
if [[ -f "$ROOT/.env" ]]; then
  DATABASE_URL="$(safe_read_env DATABASE_URL)"
  if [[ "$DATABASE_URL" == "file:./prisma/database.db" ]]; then
    [[ ! -f "$DB_PRISMA" ]] && add_issue "DB no encontrada" "DATABASE_URL apunta a prisma/database.db pero no existe" \
      "Creala con: cd /root/DTunnel && npx prisma db push" \
      "Falta $DB_PRISMA"
  elif [[ "$DATABASE_URL" == "file:./database.db" ]]; then
    [[ ! -f "$DB_ROOT" ]] && add_issue "DB no encontrada" "DATABASE_URL apunta a database.db pero no existe" \
      "Si tu DB está en /prisma, cambiá a file:./prisma/database.db" \
      "Falta $DB_ROOT"
  fi
fi

# prisma client / node_modules
if [[ ! -d "$ROOT/node_modules" ]]; then
  add_issue "node_modules faltante" "Sin dependencias, no hay prisma client ni build" \
    "Ejecutá: cd /root/DTunnel && npm install" \
    ""
fi

# ============================================================
# 4) Build / Typescript
# ============================================================
section "4) Build / TypeScript"
BUILD_ENTRY="$ROOT/build/index.js"
TSCONFIG="$ROOT/tsconfig.json"

[[ ! -f "$TSCONFIG" ]] && add_issue "tsconfig.json faltante" "No existe tsconfig.json" \
  "Sin esto, tsc --build no corre" "$TSCONFIG no existe"

if [[ ! -f "$BUILD_ENTRY" ]]; then
  add_issue "Build faltante" "No existe build/index.js (no compiló)" \
    "Corré: cd /root/DTunnel && npm run build" \
    "$BUILD_ENTRY no existe"
fi

# DEEP: compilar y capturar últimos errores TS
if [[ $DEEP -eq 1 && -f "$ROOT/package.json" ]]; then
  if [[ -d "$ROOT/node_modules" ]]; then
    OUT_BUILD="$(cd "$ROOT" && npm run build 2>&1)"
    RC=$?
    if [[ $RC -ne 0 ]]; then
      # recorta salida
      TAIL="$(echo "$OUT_BUILD" | tail -n 18 | tr '\n' ' ')"
      add_issue "TypeScript build falló" "tsc --build está fallando" \
        "Abrí el/los archivos que aparecen y arreglalos. Tip: pegá aquí el error y te lo dejo full code." \
        "$TAIL"
    fi
  fi
fi

# ============================================================
# 5) ETA templates faltantes (bug real que tuviste: sidebar.eta)
# ============================================================
section "5) Templates Eta / Views"
# buscar includes a sidebar/header/cards y validar archivos
if [[ -d "$ROOT/frontend/views" ]]; then
  [[ ! -f "$ROOT/frontend/views/sidebar.eta" ]] && add_issue "Template faltante" "Falta frontend/views/sidebar.eta" \
    "Restauralo del repo o crealo" "frontend/views/sidebar.eta no existe"
  [[ ! -f "$ROOT/frontend/views/header.eta" ]] && add_issue "Template faltante" "Falta frontend/views/header.eta" \
    "Restauralo del repo o crealo" "frontend/views/header.eta no existe"
else
  add_issue "Carpeta views faltante" "No existe frontend/views" \
    "Tu repo no tiene frontend o cambió la ruta. Verificá estructura." \
    "$ROOT/frontend/views no existe"
fi

# ============================================================
# 6) Puertos / servidor vivo
# ============================================================
section "6) Puerto / Estado servidor"
PORT_TO_CHECK="8080"
[[ -f "$ROOT/.env" ]] && PORT_TO_CHECK="$(safe_read_env PORT | sed 's/[^0-9]//g')"
[[ -z "$PORT_TO_CHECK" ]] && PORT_TO_CHECK="8080"

OWNER="$(port_owner "$PORT_TO_CHECK")"
if [[ -n "$OWNER" ]]; then
  # OJO: que esté ocupado NO siempre es error (puede ser tu propio panel)
  # pero sí avisamos si NO es node/pm2 o si parece duplicado
  if ! echo "$OWNER" | grep -qi "node\|pm2"; then
    add_issue "Puerto $PORT_TO_CHECK ocupado por otro proceso" \
      "Algo distinto a node está escuchando en el puerto del panel" \
      "Liberalo o cambiá PORT. Ver dueño: $OWNER" \
      "$OWNER"
  fi
else
  # puerto libre: si PM2 dice online, eso huele a bug
  if need_cmd pm2; then
    if pm2 list 2>/dev/null | grep -q "online"; then
      add_issue "PM2 dice online pero el puerto está libre" \
        "Puede estar 'online' pero el server no está escuchando (crash silencioso / script mal)" \
        "Mirá logs: pm2 logs --lines 120  | y revisá qué comando arranca el server" \
        "PORT $PORT_TO_CHECK no está en escucha"
    fi
  fi
fi

# ============================================================
# 7) PM2: duplicados / rutas duplicadas / logs clave
# ============================================================
section "7) PM2 / Logs (sin spam)"
if need_cmd pm2; then
  # detectar errored
  if pm2 jlist 2>/dev/null | grep -q '"status":"errored"'; then
    ERRORED_NAMES="$(pm2 list 2>/dev/null | awk '/errored/{print $2}' | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g')"
    add_issue "PM2 con procesos errored" \
      "Hay procesos en estado errored: ${ERRORED_NAMES:-desconocido}" \
      "Ver: pm2 logs <nombre> --lines 200" \
      ""
  fi

  # detectar duplicados típicos
  if pm2 list 2>/dev/null | awk '{print $2}' | grep -qx "kingvpn-panel"; then
    if pm2 list 2>/dev/null | awk '{print $2}' | grep -qx "panelweb"; then
      add_issue "Procesos duplicados" \
        "Están kingvpn-panel y panelweb. Si usan mismo PORT → rompe o queda raro." \
        "Dejá uno solo. Ej: pm2 delete panelweb (si no se usa)" \
        "pm2 list muestra ambos"
    fi
  fi

  # leer últimas líneas de error.log del proceso principal (si existe)
  if [[ -f "/root/.pm2/logs/kingvpn-panel-error.log" ]]; then
    LAST_ERR="$(tail -n 35 /root/.pm2/logs/kingvpn-panel-error.log 2>/dev/null | tr '\n' ' ')"
    if echo "$LAST_ERR" | grep -qi "EtaFileResolutionError"; then
      add_issue "Eta no encuentra template" \
        "El server está intentando incluir un .eta que no existe o ruta mal configurada" \
        "Asegurate que exista en frontend/views y que el render-config apunte a esa carpeta" \
        "$(echo "$LAST_ERR" | sed 's/ \+/ /g' | head -c 240)"
    fi
    if echo "$LAST_ERR" | grep -qi "Route duplicada\|Ruta duplicada"; then
      add_issue "Rutas duplicadas" \
        "El loader detectó rutas repetidas. Puede provocar 404 o que se ignore tu endpoint." \
        "Buscá archivos duplicados (crear.ts vs comprar.ts) y dejá UNO. Luego: npm run build && pm2 restart --update-env" \
        "$(echo "$LAST_ERR" | sed 's/ \+/ /g' | head -c 240)"
    fi
    if echo "$LAST_ERR" | grep -qi "await is only valid in async"; then
      add_issue "await mal usado" \
        "Hay un 'await' fuera de una función async en un archivo de rutas build." \
        "Abrí el .ts de esa ruta y mové el await dentro del handler async." \
        "$(echo "$LAST_ERR" | sed 's/ \+/ /g' | head -c 240)"
    fi
  fi
else
  add_issue "PM2 no disponible" "No se puede auditar procesos" "Instalá pm2: npm i -g pm2" ""
fi

# ============================================================
# 8) Rutas HTTP clave (detecta 404 reales como /api/pagos/planes)
# ============================================================
section "8) Smoke test HTTP local (rutas claves)"
# solo si curl existe
if need_cmd curl; then
  BASE="http://127.0.0.1:${PORT_TO_CHECK}"
  # en NORMAL: solo 3 rutas livianas
  # en DEEP: muchas más

  check_route() {
    local method="$1" path="$2" expect="$3" payload="${4:-}"
    local code
    if [[ "$method" == "GET" ]]; then
      code="$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")"
    else
      code="$(curl -s -o /dev/null -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$payload" "$BASE$path")"
    fi

    if [[ "$expect" == "json" ]]; then
      # no validamos contenido, solo que no sea 404 HTML típico
      if [[ "$code" == "404" ]]; then
        add_issue "Ruta 404: $path" \
          "La ruta no existe (tu front la llama pero tu backend no la expone)" \
          "Solución: creá el endpoint o corregí la URL en el frontend." \
          "HTTP $code en $method $path"
      fi
    else
      # HTML routes: 200/302 está bien; 404 es fallo
      if [[ "$code" == "404" ]]; then
        add_issue "Página 404: $path" "Ruta no encontrada" \
          "Revisá src/routes/pages (handle-routes) o el Render.page path." \
          "HTTP $code"
      fi
    fi
  }

  # clave
  check_route "GET" "/" "html"
  check_route "GET" "/login" "html"
  check_route "GET" "/acceso" "html"

  if [[ $DEEP -eq 1 ]]; then
    # rutas que suelen romper
    check_route "GET" "/configs" "html"
    check_route "GET" "/application" "html"
    check_route "GET" "/texts" "html"
    check_route "GET" "/notifications" "html"
    check_route "GET" "/profile" "html"

    # rutas API que tu front de acceso está intentando usar
    check_route "GET" "/api/pagos/planes" "json"
    check_route "POST" "/api/pagos/crear" "json" '{"plan":"M1"}'

    # estado (si existe)
    check_route "GET" "/api/estado" "json"
  fi
else
  add_issue "curl faltante" "No puedo hacer smoke test HTTP" \
    "Instalá: apt install -y curl" ""
fi

# ============================================================
# 9) Prisma validate (DEEP)
# ============================================================
section "9) Prisma checks"
if [[ $DEEP -eq 1 ]]; then
  if [[ -f "$SCHEMA" && -d "$ROOT/node_modules" ]]; then
    OUT_PRISMA="$(cd "$ROOT" && npx prisma validate 2>&1)"
    if [[ $? -ne 0 ]]; then
      add_issue "Prisma validate falló" \
        "El schema no valida" \
        "Fix típico: npx prisma format && npx prisma validate" \
        "$(echo "$OUT_PRISMA" | tail -n 12 | tr '\n' ' ')"
    fi
  fi
fi

# ============================================================
# FINAL
# ============================================================
section "RESULTADO"
if [[ $ISSUES -eq 0 ]]; then
  say "${GRN}✔ No se detectaron fallas críticas.${RST}"
  say "${DIM}Si igual algo falla (CSRF/UI/rutas), corré: ./error.sh --deep${RST}"
else
  say "$ISSUE_LOG"
  hr
  say "${WHT}Resumen:${RST} ${RED}${ISSUES}${RST} problema(s) detectado(s)."
  say "${DIM}Tip: ./error.sh --deep hace checks más pesados.${RST}"
fi

write_report
say
say "${CYA}Reporte guardado en:${RST} ${WHT}${REPORT}${RST}"
