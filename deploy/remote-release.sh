#!/usr/bin/env bash
# 在目标服务器上以 root 运行。发布包先通过 SCP 上传到 /tmp/prep-trove-app.tgz。
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/prep-trove}"
ARCHIVE="${ARCHIVE:-/tmp/prep-trove-app.tgz}"
RELEASE="${RELEASE:-$(date -u +%Y%m%dT%H%M%SZ)}"

if [ "$APP_ROOT" != "/opt/prep-trove" ]; then
  echo "unexpected APP_ROOT: $APP_ROOT" >&2
  exit 1
fi
if [ ! -f "$ARCHIVE" ]; then
  echo "release archive missing: $ARCHIVE" >&2
  exit 1
fi

release_dir="$APP_ROOT/releases/$RELEASE"
previous="$(readlink -f "$APP_ROOT/current" || true)"
if [[ "$previous" != "$APP_ROOT/releases/"* ]] || [ ! -d "$previous" ]; then
  previous=""
fi

switch_current() {
  local target="$1"
  local pending="$APP_ROOT/.current-$RELEASE"
  ln -s "$target" "$pending"
  mv -Tf "$pending" "$APP_ROOT/current"
}

mkdir -p "$release_dir"
tar xzf "$ARCHIVE" -C "$release_dir"
cd "$release_dir"

bash deploy/server-install.sh
chown -R prep-trove:prep-trove "$release_dir"
runuser -u prep-trove -- npm ci
runuser -u prep-trove -- env NODE_OPTIONS=--max-old-space-size=1024 npm run build
test -f /etc/prep-trove.env

switch_current "$release_dir"
if ! systemctl restart prep-trove.service || ! curl --fail --silent --show-error --retry 15 --retry-delay 2 --retry-connrefused http://127.0.0.1:3100/api/health >/dev/null; then
  if [ -n "$previous" ] && [ -d "$previous" ]; then
    switch_current "$previous"
    systemctl restart prep-trove.service
  else
    systemctl stop prep-trove.service
  fi
  echo "release failed and previous version restored" >&2
  exit 1
fi

systemctl start prep-trove-archive.timer prep-trove-backup.timer
systemctl start prep-trove-archive.service
systemctl start prep-trove-backup.service
rm -f "$ARCHIVE"
printf 'DEPLOY_OK release=%s\n' "$RELEASE"
