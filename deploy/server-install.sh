#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "server-install.sh must run as root" >&2
  exit 1
fi

# Archives created on Windows do not reliably preserve executable bits.
chmod 0755 deploy/*.sh

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq build-essential ca-certificates curl nginx certbot openssl python3 sqlite3 woff2 >/dev/null

if ! swapon --show=NAME --noheadings | grep -q .; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 0600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
fi

if ! command -v node >/dev/null || [ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y -qq nodejs >/dev/null
fi

if ! id prep-trove >/dev/null 2>&1; then
  useradd --system --home /var/lib/prep-trove --shell /usr/sbin/nologin prep-trove
fi

install -d -o prep-trove -g prep-trove -m 0750 /var/lib/prep-trove /var/lib/prep-trove/db /var/lib/prep-trove/files
install -d -o prep-trove -g prep-trove -m 0750 /var/backups/prep-trove
install -d -o root -g root -m 0755 /opt/prep-trove /opt/prep-trove/releases /var/www/bzzl.ysspark.cn

if [ ! -f /etc/prep-trove.env ]; then
  DI_ENV_FILE="/opt/di_backend/backend/.env"
  for key in ALIBABA_CLOUD_SMS_ACCESS_KEY_ID ALIBABA_CLOUD_SMS_ACCESS_KEY_SECRET SMS_SIGN_NAME SMS_TEMPLATE_CODE SMS_TEMPLATE_VARIABLE SMS_REGION_ID; do
    grep -q "^${key}=" "$DI_ENV_FILE" || { echo "missing ${key} in DI environment" >&2; exit 1; }
  done

  app_secret="$(openssl rand -hex 32)"

  umask 0077
  {
    printf 'APP_SECRET=%s\n' "$app_secret"
    printf 'APP_DATA_DIR=/var/lib/prep-trove\n'
    printf 'ENVIRONMENT=production\n'
    printf 'SMS_MODE=aliyun\n'
    printf 'NODE_OPTIONS=--max-old-space-size=1024\n'
    grep -E '^(ALIBABA_CLOUD_SMS_ACCESS_KEY_ID|ALIBABA_CLOUD_SMS_ACCESS_KEY_SECRET|SMS_SIGN_NAME|SMS_TEMPLATE_CODE|SMS_TEMPLATE_VARIABLE|SMS_REGION_ID)=' "$DI_ENV_FILE"
  } > /etc/prep-trove.env
fi

if ! grep -Eq '^ADMIN_ROUTE=manage-[a-f0-9]{48}$' /etc/prep-trove.env || grep -q '^ADMIN_USERNAME=admin$' /etc/prep-trove.env; then
  admin_route="manage-$(openssl rand -hex 24)"
  admin_username="operator_$(openssl rand -hex 8)"
  admin_password="$(openssl rand -hex 24)"
  admin_hash="$(printf '%s' "$admin_password" | node scripts/hash-admin-password.mjs)"
  rotated_env="$(mktemp /etc/prep-trove.env.XXXXXX)"

  grep -Ev '^(ADMIN_ROUTE|ADMIN_USERNAME|ADMIN_PASSWORD_HASH|ADMIN_PASSWORD)=' /etc/prep-trove.env > "$rotated_env"
  {
    printf 'ADMIN_ROUTE=%s\n' "$admin_route"
    printf 'ADMIN_USERNAME=%s\n' "$admin_username"
    printf 'ADMIN_PASSWORD_HASH=%s\n' "$admin_hash"
  } >> "$rotated_env"
  chown root:prep-trove "$rotated_env"
  chmod 0640 "$rotated_env"
  mv -f "$rotated_env" /etc/prep-trove.env

  umask 0077
  {
    printf 'ADMIN_URL=https://bzzl.ysspark.cn/%s\n' "$admin_route"
    printf 'ADMIN_USERNAME=%s\n' "$admin_username"
    printf 'ADMIN_PASSWORD=%s\n' "$admin_password"
  } > /root/prep-trove-admin-credentials.txt
  chmod 0600 /root/prep-trove-admin-credentials.txt
  rm -f /root/prep-trove-initial-admin-password.txt
fi

chown root:prep-trove /etc/prep-trove.env
chmod 0640 /etc/prep-trove.env

install -o root -g root -m 0644 deploy/systemd/prep-trove.service /etc/systemd/system/prep-trove.service
install -o root -g root -m 0644 deploy/systemd/prep-trove-archive.service /etc/systemd/system/prep-trove-archive.service
install -o root -g root -m 0644 deploy/systemd/prep-trove-archive.timer /etc/systemd/system/prep-trove-archive.timer
install -o root -g root -m 0644 deploy/systemd/prep-trove-backup.service /etc/systemd/system/prep-trove-backup.service
install -o root -g root -m 0644 deploy/systemd/prep-trove-backup.timer /etc/systemd/system/prep-trove-backup.timer

systemctl daemon-reload
systemctl enable prep-trove.service prep-trove-archive.timer prep-trove-backup.timer

echo "SERVER_INSTALL_OK node=$(node --version) npm=$(npm --version)"
