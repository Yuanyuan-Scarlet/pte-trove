#!/usr/bin/env bash
# 阿里云轻量服务器发布脚本：仅发布已推送的 Git HEAD，优先使用 SCP，云助手作为回退通道。
set -euo pipefail

REGION="${REGION:-cn-shanghai}"
INSTANCE_ID="${INSTANCE_ID:-c3c514211070460cb094dde74fbeadb9}"
APP_ROOT="${APP_ROOT:-/opt/prep-trove}"
SSH_TARGET="${SSH_TARGET:-root@47.116.99.82}"
SSH_KEY="${SSH_KEY:-.secrets/aliyun/ptedi.pem}"
DEPLOY_TRANSPORT="${DEPLOY_TRANSPORT:-auto}"
CHUNK="${CHUNK:-7000}"
MAX_SWAS_PACKAGE_BYTES="${MAX_SWAS_PACKAGE_BYTES:-2097152}"
MAX_SCP_PACKAGE_BYTES="${MAX_SCP_PACKAGE_BYTES:-67108864}"
RELEASE="$(date -u +%Y%m%dT%H%M%SZ)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "tracked working tree changes must be committed before deployment" >&2
  exit 1
fi

HEAD_COMMIT="$(git rev-parse HEAD)"
ORIGIN_MAIN="$(git rev-parse origin/main 2>/dev/null || true)"
if [ -z "$ORIGIN_MAIN" ] || [ "$HEAD_COMMIT" != "$ORIGIN_MAIN" ]; then
  echo "HEAD must match origin/main before deployment" >&2
  exit 1
fi

case "$DEPLOY_TRANSPORT" in
  auto)
    if [ -f "$SSH_KEY" ] && command -v ssh >/dev/null && command -v scp >/dev/null; then
      DEPLOY_TRANSPORT="scp"
    else
      DEPLOY_TRANSPORT="swas"
    fi
    ;;
  scp|swas) ;;
  *)
    echo "unsupported DEPLOY_TRANSPORT: $DEPLOY_TRANSPORT" >&2
    exit 1
    ;;
esac

ARCHIVE="$TMP/app.tgz"
ARCHIVE_PATHS=(
  .
  ':(exclude)marketing'
  ':(exclude)public/fonts/noto-sans-sc-400.ttf'
)
if [ "$DEPLOY_TRANSPORT" = "swas" ]; then
  ARCHIVE_PATHS+=(
    ':(exclude)public/og.png'
    ':(exclude)public/fonts/noto-sans-sc-400.woff2'
  )
fi

git archive --format=tar.gz --output="$ARCHIVE" HEAD -- "${ARCHIVE_PATHS[@]}"

UNSAFE_ENTRIES="$({ tar tzf "$ARCHIVE" || true; } | grep -E '(^|/)(\.git|\.secrets|node_modules|\.data|tmp|output|outputs|work|materials|history|old-sold)(/|$)|\.(pem|key|pdf|zip)$' || true)"
if [ -n "$UNSAFE_ENTRIES" ]; then
  printf 'release archive contains forbidden entries:\n%s\n' "$UNSAFE_ENTRIES" >&2
  exit 1
fi

PACKAGE_BYTES="$(stat -c%s "$ARCHIVE")"
if [ "$DEPLOY_TRANSPORT" = "swas" ] && [ "$PACKAGE_BYTES" -gt "$MAX_SWAS_PACKAGE_BYTES" ]; then
  echo "SWAS archive is too large: ${PACKAGE_BYTES}B > ${MAX_SWAS_PACKAGE_BYTES}B; use SCP" >&2
  exit 1
fi
if [ "$DEPLOY_TRANSPORT" = "scp" ] && [ "$PACKAGE_BYTES" -gt "$MAX_SCP_PACKAGE_BYTES" ]; then
  echo "SCP archive is unexpectedly large: ${PACKAGE_BYTES}B > ${MAX_SCP_PACKAGE_BYTES}B" >&2
  exit 1
fi

printf 'release=%s commit=%s transport=%s package=%sB\n' "$RELEASE" "$HEAD_COMMIT" "$DEPLOY_TRANSPORT" "$PACKAGE_BYTES"

deploy_with_scp() {
  local remote_archive="/tmp/pte-app-$RELEASE.tgz"
  local remote_script="/tmp/pte-remote-release-$RELEASE.sh"
  local ssh_options=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)

  scp "${ssh_options[@]}" "$ARCHIVE" "$SSH_TARGET:$remote_archive"
  ssh "${ssh_options[@]}" "$SSH_TARGET" \
    "set -eu; tar xOf '$remote_archive' deploy/remote-release.sh > '$remote_script'; chmod 0700 '$remote_script'; trap 'rm -f \"$remote_script\" \"$remote_archive\"' EXIT; APP_ROOT='$APP_ROOT' ARCHIVE='$remote_archive' RELEASE='$RELEASE' bash '$remote_script'"
}

run_remote() {
  local name="$1" timeout="$2" content="$3" id="" status="" output="" attempt=""
  for attempt in 1 2 3 4 5; do
    output=$(aliyun swas-open run-command --biz-region-id "$REGION" --region "$REGION" \
      --instance-id "$INSTANCE_ID" --name "$name" --type RunShellScript --timeout "$timeout" \
      --command-content "$content" 2>&1) || true
    id=$(printf '%s' "$output" | sed -n 's/.*"InvokeId": "\([^"]*\)".*/\1/p')
    [ -n "$id" ] && break
    printf 'retry(%s) #%s: %s\n' "$name" "$attempt" "$(printf '%s' "$output" | head -c 200)"
    sleep 10
  done
  [ -n "$id" ] || { printf 'FAIL(%s): no InvokeId\n' "$name"; return 1; }

  for _ in $(seq 1 320); do
    sleep 3
    status=$( { aliyun swas-open describe-invocation-result --biz-region-id "$REGION" --region "$REGION" \
      --instance-id "$INSTANCE_ID" --invoke-id "$id" \
      --cli-query 'InvocationResult.InvocationStatus' 2>/dev/null || true; } | tr -d '"')
    case "$status" in
      Success) printf 'OK(%s)\n' "$name"; return 0 ;;
      Failed|Stopped|Timeout|Error)
        printf 'FAIL(%s): %s\n' "$name" "$status"
        aliyun swas-open describe-invocation-result --biz-region-id "$REGION" --region "$REGION" \
          --instance-id "$INSTANCE_ID" --invoke-id "$id" \
          --cli-query 'InvocationResult.Output' | tr -d '"' | base64 -d
        return 1
        ;;
    esac
  done
  printf 'FAIL(%s): poll timeout\n' "$name"
  return 1
}

deploy_with_swas() {
  local md5 remote_archive remote_script file content
  md5="$(md5sum "$ARCHIVE" | awk '{print $1}')"
  remote_archive="/tmp/pte-app-$RELEASE.tgz"
  remote_script="/tmp/pte-remote-release-$RELEASE.sh"

  base64 -w0 "$ARCHIVE" > "$TMP/app.b64"
  split -b "$CHUNK" "$TMP/app.b64" "$TMP/chunk_"
  printf 'md5=%s chunks=%s\n' "$md5" "$(find "$TMP" -maxdepth 1 -name 'chunk_*' | wc -l)"

  run_remote "pte-prep-$RELEASE" 120 \
    "rm -f /tmp/pte-deploychunk_* /tmp/pte-app.b64 /tmp/pte-app.tgz '$remote_archive' '$remote_script'; echo PREP_OK"
  for file in "$TMP"/chunk_*; do
    content="$(cat "$file")"
    run_remote "pte-up-$(basename "$file")" 120 \
      "printf '%s' '$content' > /tmp/pte-deploychunk_$(basename "$file")"
  done

  run_remote "pte-release-$RELEASE" 1200 \
    "set -eu; cat /tmp/pte-deploychunk_* > /tmp/pte-app.b64; base64 -d /tmp/pte-app.b64 > '$remote_archive'; echo '$md5  $remote_archive' | md5sum -c -; tar xOf '$remote_archive' deploy/remote-release.sh > '$remote_script'; chmod 0700 '$remote_script'; trap 'rm -f /tmp/pte-deploychunk_* /tmp/pte-app.b64 \"$remote_script\" \"$remote_archive\"' EXIT; APP_ROOT='$APP_ROOT' ARCHIVE='$remote_archive' RELEASE='$RELEASE' bash '$remote_script'"
}

if [ "$DEPLOY_TRANSPORT" = "scp" ]; then
  deploy_with_scp
else
  deploy_with_swas
fi

printf 'DONE release=%s commit=%s transport=%s health=http://127.0.0.1:3100/api/health\n' \
  "$RELEASE" "$HEAD_COMMIT" "$DEPLOY_TRANSPORT"
