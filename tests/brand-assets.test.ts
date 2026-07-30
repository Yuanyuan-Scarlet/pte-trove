import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses the approved round PNG for the page brand logo", async () => {
  const logo = await readFile(new URL("../public/brand/xiaoyuan-pte-round.png", import.meta.url));

  assert.deepEqual([...logo.subarray(1, 4)], [0x50, 0x4e, 0x47], "brand logo must be a PNG");
  assert.equal(logo.subarray(12, 16).toString("ascii"), "IHDR");
  assert.equal(logo.readUInt32BE(16), 356);
  assert.equal(logo.readUInt32BE(20), 354);
  assert.equal(logo[24], 8, "brand logo must use 8-bit color channels");
  assert.equal(logo[25], 6, "round logo must preserve its transparent corners");
  assert.equal(
    createHash("sha256").update(logo).digest("hex"),
    "8ab2188038414de787a1a79afc51d70cf6e67d8f68b959b43ca1658e0dc53bc8",
  );
});

test("all page surfaces use the cache-busted brand logo", async () => {
  const consumers = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/BuyerPortal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/AdminDashboard.tsx", import.meta.url), "utf8"),
  ]);

  for (const source of consumers) {
    assert.ok(source.includes('"/brand/xiaoyuan-pte-round.png"'));
    assert.ok(!source.includes('"/brand/xiaoyuan-pte-v2.png"'));
  }
});
