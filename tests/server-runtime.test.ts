import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("persists SQLite data, enforces uniqueness, and archives private files", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "prep-trove-runtime-"));
  process.env.APP_DATA_DIR = dataRoot;
  process.env.ENVIRONMENT = "test";

  const database = await import("../lib/db");
  const storage = await import("../lib/storage");
  const files = await import("../lib/files");

  try {
    const versionId = "version-1";
    await database.run(
      "INSERT INTO material_versions (id, display_name, status, created_at, published_at, generation_deadline, expires_at) VALUES (?, ?, 'PUBLISHED', ?, ?, ?, ?)",
      versionId, "Test", 1, 1, 2, 2,
    );
    await database.run(
      "INSERT INTO buyer_bindings (id, material_version_id, product_entry, phone, order_number, status, created_at) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)",
      "binding-1", versionId, "WFD", "13800000000", "P123456789012345678", 1,
    );
    await assert.rejects(() => database.run(
      "INSERT INTO buyer_bindings (id, material_version_id, product_entry, phone, order_number, status, created_at) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)",
      "binding-2", versionId, "WFD", "13800000000", "P223456789012345678", 1,
    ));

    database.closeDatabase();
    const persisted = await database.first<{ display_name: string }>("SELECT display_name FROM material_versions WHERE id = ?", versionId);
    assert.equal(persisted?.display_name, "Test");

    const generatedKey = "materials/version-1/generated/WFD/binding-1/file.pdf";
    await storage.writeStorageObject(generatedKey, new Uint8Array([1, 2, 3]));
    await database.run(
      `INSERT INTO generated_files (id, generation_job_id, storage_key, download_filename, mime_type, file_size, checksum,
       generated_at, archive_at, archived_at, archive_storage_key, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'ACTIVE')`,
      "file-1", "job-1", generatedKey, "test.pdf", "application/pdf", 3, "checksum", 1, 2,
    );

    const sourceKey = "materials/version-1/source/WFD.pdf";
    await storage.writeStorageObject(sourceKey, new Uint8Array([4, 5, 6]));
    await database.run(
      `INSERT INTO material_assets (id, material_version_id, material_type, source_storage_key, original_filename,
       file_size, page_count, checksum, validation_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'VALID', ?)`,
      "asset-1", versionId, "WFD", sourceKey, "WFD.pdf", 3, 1, "checksum", 1,
    );

    const archived = await files.archiveExpiredFiles(3);
    assert.deepEqual(archived, { generated: 1, sources: 1 });
    assert.equal(await storage.readStorageObject(generatedKey), null);
    assert.deepEqual(Array.from(new Uint8Array((await storage.readStorageObject("old-sold/version-1/generated/WFD/binding-1/file.pdf"))!)), [1, 2, 3]);
    assert.equal(await storage.readStorageObject(sourceKey), null);
    assert.deepEqual(Array.from(new Uint8Array((await storage.readStorageObject("history/version-1/source/WFD.pdf"))!)), [4, 5, 6]);
    assert.throws(() => storage.resolveStorageKey("../outside"), /私有目录/);
  } finally {
    database.closeDatabase();
    await rm(dataRoot, { recursive: true, force: true });
  }
});
