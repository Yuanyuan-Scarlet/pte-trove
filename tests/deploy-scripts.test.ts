import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
  assert.match(source, /cleanup_old_releases/);
  assert.match(source, /"\$count" -le 6/);
  assert.match(source, /"\$target" = "\$current"/);
  assert.match(source, /"\$target" != "\$APP_ROOT\/releases\/\$name"/);
  assert.doesNotMatch(source, /ln -sfn/);
});

test("packages only the pushed Git revision and prefers SCP", async () => {
  const source = await readFile("deploy/deploy.sh", "utf8");
  assert.match(source, /git diff --quiet/);
  assert.match(source, /git rev-parse origin\/main/);
  assert.match(source, /git archive --format=tar\.gz/);
  assert.match(source, /':\(exclude\)marketing'/);
  assert.match(source, /DEPLOY_TRANSPORT="\$\{DEPLOY_TRANSPORT:-auto\}"/);
  assert.match(source, /DEPLOY_TRANSPORT="scp"/);
  assert.match(source, /MAX_SWAS_PACKAGE_BYTES/);
  assert.match(source, /release archive contains forbidden entries/);
  assert.match(source, /tar xOf '\$remote_archive' deploy\/remote-release\.sh/);
  assert.doesNotMatch(source, /tar czf "\$TMP\/app\.tgz"/);
});

test("uses the same remote release implementation for SCP and SWAS", async () => {
  const source = await readFile("deploy/deploy.sh", "utf8");
  const references = source.match(/deploy\/remote-release\.sh/g) ?? [];
  assert.equal(references.length, 2);
  assert.doesNotMatch(source, /ln -sfn/);
  assert.doesNotMatch(source, /systemctl restart prep-trove\.service/);
});

test("builds the PDF-safe watermark font from the pinned WOFF2 asset", async () => {
  const [installSource, deploySource, releaseSource, woff2, og] = await Promise.all([
    readFile("deploy/server-install.sh", "utf8"),
    readFile("deploy/deploy.sh", "utf8"),
    readFile("deploy/remote-release.sh", "utf8"),
    readFile("public/fonts/noto-sans-sc-400.woff2"),
    readFile("public/og.png"),
  ]);
  assert.match(installSource, /sqlite3 woff2/);
  assert.match(deploySource, /':\(exclude\)public\/fonts\/noto-sans-sc-400\.ttf'/);
  assert.match(releaseSource, /WOFF2_SHA256=/);
  assert.match(releaseSource, /woff2_decompress public\/fonts\/noto-sans-sc-400\.woff2/);
  assert.match(releaseSource, /test -s public\/fonts\/noto-sans-sc-400\.ttf/);

  const configuredWoff2Hash = releaseSource.match(/WOFF2_SHA256="([a-f0-9]+)"/)?.[1];
  const configuredOgHash = releaseSource.match(/OG_SHA256="([a-f0-9]+)"/)?.[1];
  assert.equal(configuredWoff2Hash?.length, 64);
  assert.equal(configuredOgHash?.length, 64);
  assert.equal(configuredWoff2Hash, createHash("sha256").update(woff2).digest("hex"));
  assert.equal(configuredOgHash, createHash("sha256").update(og).digest("hex"));
});

test("removes an incomplete release after a failed deployment", async () => {
  const source = await readFile("deploy/remote-release.sh", "utf8");
  assert.match(source, /deployment_succeeded=false/);
  assert.match(source, /trap cleanup_release_attempt EXIT/);
  assert.match(source, /"\$release_dir" != "\$current"/);
  assert.match(source, /rm -rf -- "\$release_dir"/);
  assert.match(source, /deployment_succeeded=true/);
});

test("deployment shell scripts pass Bash syntax validation", () => {
  for (const script of ["deploy/deploy.sh", "deploy/remote-release.sh"]) {
    const result = spawnSync("bash", ["-n", script], { encoding: "utf8" });
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
  }
});

test("restores executable permissions after a Windows-created release archive is unpacked", async () => {
  const source = await readFile("deploy/server-install.sh", "utf8");
  assert.match(source, /chmod 0755 deploy\/\*\.sh/);
});

test("keeps project text and deployment scripts on Unix LF line endings", async () => {
  const [attributes, ...scripts] = await Promise.all([
    readFile(".gitattributes", "utf8"),
    readFile("deploy/backup.sh", "utf8"),
    readFile("deploy/deploy.sh", "utf8"),
    readFile("deploy/remote-release.sh", "utf8"),
    readFile("deploy/server-install.sh", "utf8"),
  ]);

  assert.match(attributes, /^\* text=auto eol=lf$/m);
  for (const source of scripts) assert.doesNotMatch(source, /\r/);
});
