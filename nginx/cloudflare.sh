#!/bin/bash
set -euo pipefail

FIREWALL="/root/firewall.sh"
CLOUDFLARE_FILE_PATH="/etc/nginx/cloudflare"

# (Opcional) Cambiá esto por tu IP pública para asegurar SSH SOLO para vos
# MY_IP="1.2.3.4"
MY_IP=""

echo "=== Generando reglas UFW y archivo real-ip de Cloudflare ==="

# Crear scripts/archivos limpios (no append)
: > "$FIREWALL"
: > "$CLOUDFLARE_FILE_PATH"

chmod 700 "$FIREWALL"

{
  echo "sudo ufw --force reset"
  echo "sudo ufw default deny incoming"
  echo "sudo ufw default allow outgoing"
  echo ""
  echo "# Permitir HTTP/HTTPS SOLO desde Cloudflare"
} >> "$FIREWALL"

{
  echo "# Cloudflare Real IP"
  echo "# IPv4"
} >> "$CLOUDFLARE_FILE_PATH"

# IPv4 CF
curl -fsSL https://www.cloudflare.com/ips-v4 | while read -r ip; do
  [ -z "$ip" ] && continue
  echo "sudo ufw allow from $ip to any port 80 proto tcp"  >> "$FIREWALL"
  echo "sudo ufw allow from $ip to any port 443 proto tcp" >> "$FIREWALL"
  echo "set_real_ip_from $ip;" >> "$CLOUDFLARE_FILE_PATH"
done

{
  echo ""
  echo "# IPv6"
} >> "$CLOUDFLARE_FILE_PATH"

# IPv6 CF
curl -fsSL https://www.cloudflare.com/ips-v6 | while read -r ip; do
  [ -z "$ip" ] && continue
  echo "sudo ufw allow from $ip to any port 80 proto tcp"  >> "$FIREWALL"
  echo "sudo ufw allow from $ip to any port 443 proto tcp" >> "$FIREWALL"
  echo "set_real_ip_from $ip;" >> "$CLOUDFLARE_FILE_PATH"
done

{
  echo ""
  echo "real_ip_header CF-Connecting-IP;"
  echo "real_ip_recursive on;"
} >> "$CLOUDFLARE_FILE_PATH"

# SSH: recomendado restringir
{
  echo ""
  if [ -n "$MY_IP" ]; then
    echo "# SSH solo desde tu IP"
    echo "sudo ufw allow from $MY_IP to any port 22 proto tcp"
  else
    echo "# SSH abierto (recomendado restringir a tu IP)"
    echo "sudo ufw allow 22/tcp"
  fi
  echo ""
  echo "sudo ufw --force enable"
  echo "sudo ufw reload"
} >> "$FIREWALL"

echo "=== Probando Nginx ==="
nginx -t

echo "=== Aplicando firewall (UFW) ==="
sudo bash "$FIREWALL"

echo "=== Recargando Nginx ==="
sudo systemctl reload nginx

rm -f "$FIREWALL"
echo "OK ✅"
