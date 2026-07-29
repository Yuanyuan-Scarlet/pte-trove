import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("generates non-default production administrator credentials", async () => {
  const source = await readFile("deploy/server-install.sh", "utf8");
  assert.match(source, /admin_route="manage-\$\(openssl rand -hex 24\)"/);
  assert.match(source, /admin_username="operator_\$\(openssl rand -hex 8\)"/);
  assert.match(source, /admin_password="\$\(openssl rand -hex 24\)"/);
  assert.doesNotMatch(source, /printf 'ADMIN_USERNAME=admin/);

  const result = spawnSync(
    "bash",
    [
      "-c",
      [
        "set -euo pipefail",
        "admin_route=\"manage-$(openssl rand -hex 24)\"",
        "admin_username=\"operator_$(openssl rand -hex 8)\"",
        "admin_password=\"$(openssl rand -hex 24)\"",
        "[[ $admin_route =~ ^manage-[a-f0-9]{48}$ ]]",
        "[[ $admin_username =~ ^operator_[a-f0-9]{16}$ ]]",
        "[[ $admin_password =~ ^[a-f0-9]{48}$ ]]",
      ].join("\n"),
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
});

test("switches releases atomically and rejects current as a rollback target", async () => {
  const source = await readFile("deploy/remote-release.sh", "utf8");
  assert.match(source, /mv -Tf "\$pending" "\$APP_ROOT\/current"/);
  assert.match(source, /"\$APP_ROOT\/releases\/"\*/);
  assert.match(source, /--retry-connrefused/);
  assert.match(source, /systemctl start prep-trove-archive\.timer prep-trove-backup\.timer/);
  assert.doesNotMatch(source, /ln -sfn/);
});

test("builds the PDF-safe watermark font from the pinned WOFF2 asset", async () => {
  const [installSource, deploySource] = await Promise.all([
    readFile("deploy/server-install.sh", "utf8"),
    readFile("deploy/deploy.sh", "utf8"),
  ]);
  assert.match(installSource, /sqlite3 woff2/);
  assert.match(deploySource, /--exclude='\.\/public\/fonts\/noto-sans-sc-400\.ttf'/);
  assert.match(deploySource, /woff2_decompress public\/fonts\/noto-sans-sc-400\.woff2/);
  assert.match(deploySource, /test -s public\/fonts\/noto-sans-sc-400\.ttf/);
});

test("restores executable permissions after a Windows-created release archive is unpacked", async () => {
  const source = await readFile("deploy/server-install.sh", "utf8");
  assert.match(source, /chmod 0755 deploy\/\*\.sh/);
});
