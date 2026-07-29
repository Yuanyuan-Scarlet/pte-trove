#!/usr/bin/env bash
# 阿里云轻量服务器发布脚本：本地打包，经 SWAS 云助手上传，在服务器构建并原子切换。
set -euo pipefail

REGION="${REGION:-cn-shanghai}"
INSTANCE_ID="${INSTANCE_ID:-c3c514211070460cb094dde74fbeadb9}"
APP_ROOT="${APP_ROOT:-/opt/prep-trove}"
CHUNK=7000
RELEASE="$(date -u +%Y%m%dT%H%M%SZ)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

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

tar czf "$TMP/app.tgz" \
  --exclude='./.git' \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.data' \
  --exclude='./.npm-cache' \
  --exclude='./.openai' \
  --exclude='./.tmp' \
  --exclude='./.wrangler' \
  --exclude='./dist' \
  --exclude='./.env' \
  --exclude='./.dev.vars' \
  --exclude='./public/og.png' \
  --exclude='./public/fonts/noto-sans-sc-400.woff2' \
  --exclude='./public/fonts/noto-sans-sc-400.ttf' \
  .

MD5="$(md5sum "$TMP/app.tgz" | awk '{print $1}')"
base64 -w0 "$TMP/app.tgz" > "$TMP/app.b64"
split -b "$CHUNK" "$TMP/app.b64" "$TMP/chunk_"
printf 'release=%s package=%sB md5=%s chunks=%s\n' "$RELEASE" "$(stat -c%s "$TMP/app.tgz")" "$MD5" "$(find "$TMP" -maxdepth 1 -name 'chunk_*' | wc -l)"

run_remote "pte-prep-$RELEASE" 120 "rm -f /tmp/pte-deploychunk_* /tmp/pte-app.b64 /tmp/pte-app.tgz && echo PREP_OK"
for file in "$TMP"/chunk_*; do
  content="$(cat "$file")"
  run_remote "pte-up-$(basename "$file")" 120 "printf '%s' '$content' > /tmp/pte-deploychunk_$(basename "$file")"
  sleep 2
done

run_remote "pte-unpack-$RELEASE" 240 "set -eu; cd /tmp; cat /tmp/pte-deploychunk_* > pte-app.b64; base64 -d pte-app.b64 > pte-app.tgz; echo '$MD5  /tmp/pte-app.tgz' | md5sum -c -; release='$APP_ROOT/releases/$RELEASE'; mkdir -p \"\$release/public/fonts\"; tar xzf /tmp/pte-app.tgz -C \"\$release\"; curl -fsSL --retry 5 --retry-delay 2 https://raw.githubusercontent.com/Yuanyuan-Scarlet/pte-trove/main/public/og.png -o \"\$release/public/og.png\"; curl -fsSL --retry 5 --retry-delay 2 https://raw.githubusercontent.com/Yuanyuan-Scarlet/pte-trove/main/public/fonts/noto-sans-sc-400.woff2 -o \"\$release/public/fonts/noto-sans-sc-400.woff2\"; echo '8d8637f8ea56d53a8cc54843ca6f73b7809d7670306361d1f7e15084f9b70b47  '\"\$release/public/og.png\" | sha256sum -c -; echo 'eb385eca10dd39caff881c38338aefccecefaec6b42cc016fbe81434e388d6c3a  '\"\$release/public/fonts/noto-sans-sc-400.woff2\" | sha256sum -c -; rm -f /tmp/pte-app.b64 /tmp/pte-app.tgz /tmp/pte-deploychunk_*; cd \"\$release\"; bash deploy/server-install.sh; woff2_decompress public/fonts/noto-sans-sc-400.woff2; test -s public/fonts/noto-sans-sc-400.ttf; chown -R prep-trove:prep-trove \"\$release\"; echo UNPACK_OK"

run_remote "pte-build-$RELEASE" 900 "set -eu; release='$APP_ROOT/releases/$RELEASE'; cd \"\$release\"; runuser -u prep-trove -- npm ci; runuser -u prep-trove -- npm run build; test -f /etc/prep-trove.env; echo BUILD_OK"

run_remote "pte-switch-$RELEASE" 180 "set -eu; release='$APP_ROOT/releases/$RELEASE'; previous=\$(readlink -f '$APP_ROOT/current' || true); ln -sfn \"\$release\" '$APP_ROOT/current'; systemctl restart prep-trove.service; if ! curl --fail --silent --show-error --retry 10 --retry-delay 2 http://127.0.0.1:3100/api/health >/dev/null; then if [ -n \"\$previous\" ] && [ -d \"\$previous\" ]; then ln -sfn \"\$previous\" '$APP_ROOT/current'; systemctl restart prep-trove.service; fi; exit 1; fi; systemctl start prep-trove-archive.service; systemctl start prep-trove-backup.service; echo DEPLOY_OK"

printf 'DONE release=%s health=http://127.0.0.1:3100/api/health\n' "$RELEASE"
