import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("migration enforces one-to-one phone and order bindings", async () => {
  const migration = await readFile(new URL("../drizzle/0000_amusing_nightcrawler.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE UNIQUE INDEX `bindings_phone_unique` ON `buyer_bindings` \(`material_version_id`,`product_entry`,`phone`\)/i);
  assert.match(migration, /CREATE UNIQUE INDEX `bindings_order_unique` ON `buyer_bindings` \(`material_version_id`,`product_entry`,`order_number`\)/i);
});
