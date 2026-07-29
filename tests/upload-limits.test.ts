import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isMaterialUploadSizeAllowed, MATERIAL_UPLOAD_LIMIT_BYTES } from "../lib/constants";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIB = 1024 * 1024;

test("allows DI through 100 MiB while other material types stop at 50 MiB", () => {
  assert.equal(MATERIAL_UPLOAD_LIMIT_BYTES.DI, 100 * MIB);
  assert.equal(isMaterialUploadSizeAllowed("DI", 50 * MIB + 1), true);
  assert.equal(isMaterialUploadSizeAllowed("DI", 100 * MIB), true);
  assert.equal(isMaterialUploadSizeAllowed("DI", 100 * MIB + 1), false);

  for (const type of ["WFD", "SST", "RS", "WE"] as const) {
    assert.equal(MATERIAL_UPLOAD_LIMIT_BYTES[type], 50 * MIB);
    assert.equal(isMaterialUploadSizeAllowed(type, 50 * MIB), true);
    assert.equal(isMaterialUploadSizeAllowed(type, 50 * MIB + 1), false);
  }
});

test("nginx accepts multipart requests containing a 100 MiB DI file", async () => {
  for (const filename of ["bzzl.ysspark.cn.conf", "bzzl.ysspark.cn.http.conf"]) {
    const config = await readFile(path.join(projectRoot, "deploy", "nginx", filename), "utf8");
    assert.match(config, /^\s*client_max_body_size 110m;$/m);
  }
});
