import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { prepareStandaloneAssets } from "../scripts/prepare-standalone.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("copies public and static assets into standalone output", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "prep-trove-standalone-"));

  try {
    await mkdir(path.join(root, "public", "brand"), { recursive: true });
    await mkdir(path.join(root, ".next", "static", "chunks"), { recursive: true });
    await mkdir(path.join(root, ".next", "standalone"), { recursive: true });
    await writeFile(path.join(root, "public", "brand", "logo.png"), "brand-asset");
    await writeFile(path.join(root, ".next", "static", "chunks", "app.js"), "client-asset");

    await prepareStandaloneAssets(root);

    assert.equal(
      await readFile(path.join(root, ".next", "standalone", "public", "brand", "logo.png"), "utf8"),
      "brand-asset",
    );
    assert.equal(
      await readFile(path.join(root, ".next", "standalone", ".next", "static", "chunks", "app.js"), "utf8"),
      "client-asset",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local and systemd startup use the standalone server", async () => {
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  const service = await readFile(path.join(projectRoot, "deploy", "systemd", "prep-trove.service"), "utf8");

  assert.equal(packageJson.scripts.start, "node .next/standalone/server.js");
  assert.match(service, /^Environment=HOSTNAME=127\.0\.0\.1$/m);
  assert.match(service, /^Environment=PORT=3100$/m);
  assert.match(service, /^ExecStart=\/usr\/bin\/node \.next\/standalone\/server\.js$/m);
  assert.doesNotMatch(service, /next start/);
});
