#!/usr/bin/env bash
set -euo pipefail

DB="./prisma/database.db"
PLAN_CODE="plan_1m"

# Colores / estilo
TITLE="PANEL KING•VPN"
MSG="ACTUALIZA EL PRECIO DE TU PANEL"

if [[ ! -f "$DB" ]]; then
  whiptail --title "$TITLE" --msgbox "❌ No se encontró la base de datos:\n$DB" 10 60
  exit 1
fi

# Precio actual
CURRENT="$(sqlite3 "$DB" "SELECT price_ars FROM plans WHERE code='$PLAN_CODE' LIMIT 1;")"
if [[ -z "${CURRENT:-}" ]]; then
  whiptail --title "$TITLE" --msgbox "❌ No existe el plan '$PLAN_CODE' en la tabla plans." 10 60
  exit 1
fi

# Pedir precio
NEW_PRICE="$(whiptail --title "$TITLE" --inputbox "$MSG\n\nPlan: $PLAN_CODE (30 días)\nPrecio actual: $CURRENT ARS\n\nIngresá el nuevo precio (solo números):" 14 70 "$CURRENT" 3>&1 1>&2 2>&3 || true)"

# Si apretó Cancel en el inputbox
if [[ -z "${NEW_PRICE:-}" ]]; then
  whiptail --title "$TITLE" --msgbox "❎ Cancelado. No se realizaron cambios." 10 60
  exit 0
fi

# Validar número entero
if ! [[ "$NEW_PRICE" =~ ^[0-9]+$ ]]; then
  whiptail --title "$TITLE" --msgbox "❌ El precio debe ser un número entero.\nEj: 7000" 10 60
  exit 1
fi

# Menú Guardar/Cancelar
CHOICE="$(whiptail --title "$TITLE" --menu "Confirmación\n\nNuevo precio: $NEW_PRICE ARS\n\n¿Qué querés hacer?" 15 70 2 \
  "1" "Guardar" \
  "2" "Cancelar y cerrar" \
  3>&1 1>&2 2>&3 || true)"

if [[ "$CHOICE" != "1" ]]; then
  whiptail --title "$TITLE" --msgbox "❎ Cancelado. No se realizaron cambios." 10 60
  exit 0
fi

# Guardar en DB
sqlite3 "$DB" "UPDATE plans SET price_ars=$NEW_PRICE, updated_at=datetime('now') WHERE code='$PLAN_CODE';"

# Mostrar resultado final
UPDATED="$(sqlite3 "$DB" "SELECT price_ars FROM plans WHERE code='$PLAN_CODE' LIMIT 1;")"
whiptail --title "$TITLE" --msgbox "✅ Listo!\n\nPlan: $PLAN_CODE (30 días)\nNuevo precio: $UPDATED ARS\n\nSe actualizó correctamente." 12 60
