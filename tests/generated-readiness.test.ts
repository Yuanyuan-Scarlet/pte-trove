import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import type { LinkRecord } from "../lib/links";

test("never reports ready for a missing or wrong-size file and allows regeneration", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "prep-trove-readiness-"));
  process.env.APP_DATA_DIR = dataRoot;
  process.env.ENVIRONMENT = "test";
  process.env.SMS_MODE = "mock";
  process.env.APP_SECRET = "generated-readiness-test-secret-20260729";

  const database = await import("../lib/db");
  const storage = await import("../lib/storage");
  const links = await import("../lib/links");
  const crypto = await import("../lib/crypto");
  const sms = await import("../lib/sms");
  const buyer = await import("../lib/buyer");

  const now = Date.now();
  const versionId = "readiness-version";
  const link: LinkRecord = {
    linkId: "readiness-link",
    materialVersionId: versionId,
    displayName: "Readiness",
    productEntry: "WFD",
    publishedAt: now - 1_000,
    generationDeadline: now + 60_000,
    expiresAt: now + 120_000,
  };

  async function seedBinding(
    suffix: string,
    phone: string,
    orderNumber: string,
    actualBytes: Uint8Array | null,
  ) {
    const bindingId = `binding-${suffix}`;
    const jobId = `job-${suffix}`;
    const fileId = `file-${suffix}`;
    const storageKey = `materials/${versionId}/generated/WFD/${bindingId}/file.pdf`;
    const sessionToken = `session-${suffix}`;

    await database.run(
      "INSERT INTO buyer_bindings (id, material_version_id, product_entry, phone, order_number, status, created_at) VALUES (?, ?, 'WFD', ?, ?, 'ACTIVE', ?)",
      bindingId, versionId, phone, orderNumber, now,
    );
    await database.run(
      "INSERT INTO generation_jobs (id, buyer_binding_id, status, error_code, attempt_count, created_at, started_at, completed_at) VALUES (?, ?, 'SUCCEEDED', NULL, 1, ?, ?, ?)",
      jobId, bindingId, now, now, now,
    );
    await database.run(
      `INSERT INTO generated_files (id, generation_job_id, storage_key, download_filename, mime_type, file_size,
       checksum, generated_at, archive_at, archived_at, archive_storage_key, status)
       VALUES (?, ?, ?, 'PTE突击宝藏资料-WFD.pdf', 'application/pdf', 3, 'checksum', ?, ?, NULL, NULL, 'ACTIVE')`,
      fileId, jobId, storageKey, now, now + 120_000,
    );
    await database.run(
      "INSERT INTO buyer_sessions (id, buyer_binding_id, token_hash, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)",
      `session-id-${suffix}`, bindingId, await crypto.sha256(sessionToken), now, now + 120_000,
    );
    if (actualBytes) await storage.writeStorageObject(storageKey, actualBytes);

    const request = new Request("http://localhost:3000/status", {
      headers: { cookie: `${links.buyerCookieName(link.linkId)}=${sessionToken}` },
    });
    return { bindingId, jobId, fileId, storageKey, request, phone, orderNumber };
  }

  try {
    await database.run(
      "INSERT INTO material_versions (id, display_name, status, created_at, published_at, generation_deadline, expires_at) VALUES (?, 'Readiness', 'PUBLISHED', ?, ?, ?, ?)",
      versionId, now, link.publishedAt, link.generationDeadline, link.expiresAt,
    );
    const sourceDocument = await PDFDocument.create();
    sourceDocument.addPage([300, 400]);
    const sourceBytes = await sourceDocument.save();
    const sourceKey = `materials/${versionId}/source/WFD.pdf`;
    await storage.writeStorageObject(sourceKey, sourceBytes);
    await database.run(
      `INSERT INTO material_assets (id, material_version_id, material_type, source_storage_key, original_filename,
       file_size, page_count, checksum, validation_status, created_at)
       VALUES ('source-WFD', ?, 'WFD', ?, 'WFD.pdf', ?, 1, 'source-checksum', 'VALID', ?)`,
      versionId, sourceKey, sourceBytes.byteLength, now,
    );

    const missing = await seedBinding("missing", "13800000001", "P000000000000000001", null);
    const wrongSize = await seedBinding("wrong-size", "13800000002", "P000000000000000002", new Uint8Array([1, 2]));
    const valid = await seedBinding("valid", "13800000003", "P000000000000000003", new Uint8Array([1, 2, 3]));

    for (const broken of [missing, wrongSize]) {
      const state = await links.getBuyerSessionState(broken.request, link);
      assert.equal(state?.jobStatus, "FAILED");
      assert.equal(state?.fileId, null);
      assert.equal((await database.first<{ status: string }>("SELECT status FROM generated_files WHERE id = ?", broken.fileId))?.status, "MISSING");
      const job = await database.first<{ status: string; error_code: string }>(
        "SELECT status, error_code FROM generation_jobs WHERE id = ?",
        broken.jobId,
      );
      assert.deepEqual(job, { status: "FAILED", error_code: "FILE_MISSING" });
    }

    const validState = await links.getBuyerSessionState(valid.request, link);
    assert.equal(validState?.jobStatus, "SUCCEEDED");
    assert.equal(validState?.fileId, valid.fileId);

    const otp = await sms.issueOtp(missing.phone, "127.0.0.1");
    assert.ok(otp.devCode);
    const regenerated = await buyer.accessBuyerFile(
      new Request("http://localhost:3000/access", { headers: { host: "localhost:3000" } }),
      link,
      missing.phone,
      otp.devCode,
      missing.orderNumber,
    );
    assert.equal(regenerated.state, "READY");

    const recoveredState = await links.getBuyerSessionState(missing.request, link);
    assert.equal(recoveredState?.jobStatus, "SUCCEEDED");
    assert.ok(recoveredState?.storageKey);
    assert.equal(await storage.storageObjectMatches(recoveredState!.storageKey!, recoveredState!.fileSize!), true);
    assert.equal(
      (await database.first<{ count: number }>("SELECT COUNT(*) AS count FROM generated_files WHERE generation_job_id = ?", missing.jobId))?.count,
      1,
    );
  } finally {
    database.closeDatabase();
    await rm(dataRoot, { recursive: true, force: true });
  }
});
