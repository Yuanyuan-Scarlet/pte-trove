import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("migration enforces one-to-one phone and order bindings", async () => {
  const migration = await readFile(new URL("../drizzle/0000_amusing_nightcrawler.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE UNIQUE INDEX `bindings_phone_unique` ON `buyer_bindings` \(`material_version_id`,`product_entry`,`phone`\)/i);
  assert.match(migration, /CREATE UNIQUE INDEX `bindings_order_unique` ON `buyer_bindings` \(`material_version_id`,`product_entry`,`order_number`\)/i);
});

test("migration records manual generations with their archive index", async () => {
  const migration = await readFile(new URL("../drizzle/0002_smart_wilson_fisk.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE `manual_generations` \(/i);
  for (const column of ["salutation", "phone", "status", "storage_key", "download_filename", "archive_at"]) {
    assert.match(migration, new RegExp(`\`${column}\``), `manual_generations must declare ${column}`);
  }
  assert.match(migration, /CREATE INDEX `manual_version_created_idx` ON `manual_generations` \(`material_version_id`,`created_at`\)/i);
  assert.match(migration, /CREATE INDEX `manual_archive_idx` ON `manual_generations` \(`status`,`archive_at`\)/i);
});
