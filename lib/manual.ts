import { FILE_RETENTION_MS, MANUAL_PHONE_MAX_LENGTH, MANUAL_SALUTATION_MAX_LENGTH, manualDownloadName, type ProductEntry } from "./constants";
import { randomId } from "./crypto";
import { all, first, run } from "./db";
import {
  getLinkPhase,
  isProductEntry,
  isValidManualPhone,
  isValidSalutation,
  normalizeManualPhone,
  normalizeSalutation,
} from "./domain";
import { generateManualArtifact } from "./files";
import { HttpError } from "./http";
import { storageObjectMatches } from "./storage";

const STALE_PROCESSING_MS = 10 * 60 * 1000;

interface ManualRow {
  id: string;
  product_entry: ProductEntry;
  salutation: string;
  phone: string;
  status: string;
  error_code: string | null;
  download_filename: string | null;
  file_size: number | null;
  generated_at: number | null;
  created_at: number;
}

export interface ManualGenerationView {
  id: string;
  entry: ProductEntry;
  salutation: string;
  phone: string;
  status: string;
  errorCode: string | null;
  downloadFilename: string | null;
  fileSize: number | null;
  generatedAt: number | null;
  createdAt: number;
}

function toView(row: ManualRow): ManualGenerationView {
  return {
    id: row.id,
    entry: row.product_entry,
    salutation: row.salutation,
    phone: row.phone,
    status: row.status,
    errorCode: row.error_code,
    downloadFilename: row.download_filename,
    fileSize: row.file_size,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
  };
}

async function requireGeneratableVersion(versionId: string): Promise<void> {
  const version = await first<{ status: string; published_at: number | null; generation_deadline: number | null; expires_at: number | null }>(
    "SELECT status, published_at, generation_deadline, expires_at FROM material_versions WHERE id = ?",
    versionId,
  );
  if (!version) throw new HttpError(404, "资料版本不存在", "VERSION_NOT_FOUND");
  if (version.status !== "PUBLISHED") throw new HttpError(409, "请先发布该资料版本", "VERSION_NOT_PUBLISHED");
  const phase = getLinkPhase(version.published_at, version.generation_deadline, version.expires_at);
  if (phase === "EXPIRED") throw new HttpError(409, "该版本链接已失效，原始资料已归档，无法再生成", "VERSION_EXPIRED");
}

export async function createManualGeneration(
  versionId: string,
  rawEntry: unknown,
  rawSalutation: unknown,
  rawPhone: unknown,
): Promise<ManualGenerationView> {
  const entry = String(rawEntry ?? "");
  if (!isProductEntry(entry)) throw new HttpError(400, "未知商品入口", "INVALID_PRODUCT_ENTRY");
  const salutation = normalizeSalutation(rawSalutation);
  if (!isValidSalutation(salutation)) throw new HttpError(400, `请输入称呼（${MANUAL_SALUTATION_MAX_LENGTH}字以内）`, "INVALID_SALUTATION");
  const phone = normalizeManualPhone(rawPhone);
  if (!isValidManualPhone(phone)) throw new HttpError(400, `请输入电话（${MANUAL_PHONE_MAX_LENGTH}字以内）`, "INVALID_MANUAL_PHONE");
  await requireGeneratableVersion(versionId);

  const manualId = randomId();
  const createdAt = Date.now();
  await run(
    `INSERT INTO manual_generations (
      id, material_version_id, product_entry, salutation, phone, status, error_code,
      storage_key, download_filename, mime_type, file_size, checksum,
      generated_at, archive_at, archived_at, archive_storage_key, created_at
    ) VALUES (?, ?, ?, ?, ?, 'PROCESSING', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
    manualId, versionId, entry, salutation, phone, createdAt,
  );

  try {
    const artifact = await generateManualArtifact(versionId, entry, manualId, phone, salutation);
    await run(
      `UPDATE manual_generations SET status = 'ACTIVE', storage_key = ?, download_filename = ?, mime_type = ?,
       file_size = ?, checksum = ?, generated_at = ?, archive_at = ? WHERE id = ?`,
      artifact.storageKey, manualDownloadName(entry, salutation), artifact.mimeType,
      artifact.fileSize, artifact.checksum, artifact.generatedAt, artifact.generatedAt + FILE_RETENTION_MS, manualId,
    );
  } catch (error) {
    const code = error instanceof HttpError ? error.code : "GENERATION_FAILED";
    await run("UPDATE manual_generations SET status = 'FAILED', error_code = ? WHERE id = ?", code, manualId).catch(() => undefined);
    throw error;
  }

  const row = await first<ManualRow>(
    "SELECT id, product_entry, salutation, phone, status, error_code, download_filename, file_size, generated_at, created_at FROM manual_generations WHERE id = ?",
    manualId,
  );
  if (!row) throw new HttpError(500, "手动生成记录读取失败", "MANUAL_RECORD_MISSING");
  return toView(row);
}

export async function listManualGenerations(versionId: string): Promise<ManualGenerationView[]> {
  await run(
    "UPDATE manual_generations SET status = 'FAILED', error_code = 'STALE_JOB' WHERE material_version_id = ? AND status = 'PROCESSING' AND created_at < ?",
    versionId, Date.now() - STALE_PROCESSING_MS,
  );
  const rows = await all<ManualRow>(
    "SELECT id, product_entry, salutation, phone, status, error_code, download_filename, file_size, generated_at, created_at FROM manual_generations WHERE material_version_id = ? ORDER BY created_at DESC",
    versionId,
  );
  return rows.map(toView);
}

export async function getManualDownload(manualId: string): Promise<{ storageKey: string; mimeType: string; downloadFilename: string }> {
  const row = await first<{ status: string; storage_key: string | null; mime_type: string | null; download_filename: string | null; file_size: number | null }>(
    "SELECT status, storage_key, mime_type, download_filename, file_size FROM manual_generations WHERE id = ?",
    manualId,
  );
  if (!row) throw new HttpError(404, "手动生成记录不存在", "MANUAL_RECORD_NOT_FOUND");
  if (row.status !== "ACTIVE" || !row.storage_key || !row.mime_type || !row.download_filename) {
    throw new HttpError(404, "该记录没有可下载的文件", "MANUAL_FILE_UNAVAILABLE");
  }
  if (!await storageObjectMatches(row.storage_key, row.file_size ?? -1)) {
    await run("UPDATE manual_generations SET status = 'MISSING' WHERE id = ?", manualId).catch(() => undefined);
    throw new HttpError(404, "文件已不在服务器上，请重新生成", "MANUAL_FILE_MISSING");
  }
  return { storageKey: row.storage_key, mimeType: row.mime_type, downloadFilename: row.download_filename };
}
