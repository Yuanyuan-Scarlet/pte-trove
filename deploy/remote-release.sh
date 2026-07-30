#!/usr/bin/env bash
# 在目标服务器上以 root 运行。发布包通过 SCP 或云助手上传到 /tmp。
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/prep-trove}"
ARCHIVE="${ARCHIVE:-/tmp/prep-trove-app.tgz}"
RELEASE="${RELEASE:-$(date -u +%Y%m%dT%H%M%SZ)}"
OG_SHA256="8d8637f8ea56d53a8cc54843ca6f73b7809d7670306361d1f7e15084f9b70b47"
WOFF2_SHA256="eb385eca10dd39caff881c38338aefccecefaec6b42cc016fbe81434e388d6c3a"

if [ "$APP_ROOT" != "/opt/prep-trove" ]; then
  echo "unexpected APP_ROOT: $APP_ROOT" >&2
  exit 1
fi
if [[ ! "$RELEASE" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]; then
  echo "invalid release identifier: $RELEASE" >&2
  exit 1
fi
case "$ARCHIVE" in
  /tmp/pte-app-*.tgz|/tmp/prep-trove-app.tgz) ;;
  *)
    echo "unexpected release archive path: $ARCHIVE" >&2
    exit 1
    ;;
esac
if [ ! -f "$ARCHIVE" ]; then
  echo "release archive missing: $ARCHIVE" >&2
  exit 1
fi
ARCHIVE_ENTRIES="$(tar tzf "$ARCHIVE")"
if printf '%s\n' "$ARCHIVE_ENTRIES" | grep -E '(^/|(^|/)\.\.(/|$))' >/dev/null; then
  echo "release archive contains an unsafe path" >&2
  exit 1
fi

release_dir="$APP_ROOT/releases/$RELEASE"
previous="$(readlink -f "$APP_ROOT/current" || true)"
if [[ "$previous" != "$APP_ROOT/releases/"* ]] || [ ! -d "$previous" ]; then
  previous=""
fi
if [ -e "$release_dir" ]; then
  echo "release directory already exists: $release_dir" >&2
  exit 1
fi

cleanup_archive() {
  rm -f -- "$ARCHIVE"
}
trap cleanup_archive EXIT

switch_current() {
  local target="$1"
  local pending="$APP_ROOT/.current-$RELEASE"
  rm -f -- "$pending"
  ln -s "$target" "$pending"
  mv -Tf "$pending" "$APP_ROOT/current"
}

ensure_asset() {
  local target="$1" url="$2" expected="$3" download="$1.download-$RELEASE"
  if [ -f "$target" ] && echo "$expected  $target" | sha256sum -c - >/dev/null 2>&1; then
    return
  fi
  rm -f -- "$download"
  curl -fsSL --retry 5 --retry-delay 2 "$url" -o "$download"
  echo "$expected  $download" | sha256sum -c -
  mv -f -- "$download" "$target"
}

cleanup_old_releases() {
  local current name target count=0
  local -a names=()
  current="$(readlink -f "$APP_ROOT/current")"
  mapfile -t names < <(
    find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' \
      | grep -E '^[0-9]{8}T[0-9]{6}Z$' \
      | sort -r
  )

  for name in "${names[@]}"; do
    target="$(readlink -f "$APP_ROOT/releases/$name")"
    if [ "$target" != "$APP_ROOT/releases/$name" ] || [ ! -d "$target" ]; then
      echo "refusing to inspect unsafe release target: $target" >&2
      return 1
    fi
    count=$((count + 1))
    if [ "$count" -le 6 ] || [ "$target" = "$current" ]; then
      continue
    fi
    rm -rf -- "$target"
    printf 'REMOVED_OLD_RELEASE %s\n' "$name"
  done
}

mkdir -p "$release_dir"
tar xzf "$ARCHIVE" -C "$release_dir"
cd "$release_dir"

bash deploy/server-install.sh
mkdir -p public/fonts
ensure_asset \
  public/og.png \
  https://raw.githubusercontent.com/Yuanyuan-Scarlet/pte-trove/main/public/og.png \
  "$OG_SHA256"
ensure_asset \
  public/fonts/noto-sans-sc-400.woff2 \
  https://raw.githubusercontent.com/Yuanyuan-Scarlet/pte-trove/main/public/fonts/noto-sans-sc-400.woff2 \
  "$WOFF2_SHA256"
rm -f -- public/fonts/noto-sans-sc-400.ttf
woff2_decompress public/fonts/noto-sans-sc-400.woff2
test -s public/fonts/noto-sans-sc-400.ttf

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
cleanup_old_releases
printf 'DEPLOY_OK release=%s\n' "$RELEASE"
