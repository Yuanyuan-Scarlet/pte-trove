import { DOWNLOAD_NAMES, FILE_RETENTION_MS, MATERIAL_TYPES, type MaterialType, type ProductEntry } from "./constants";
import { randomId, sha256Bytes } from "./crypto";
import { all, first, run } from "./db";
import { HttpError } from "./http";
import { addPhoneWatermark, buildBundle, outputMimeType } from "./pdf";
import { deleteStorageObject, moveStorageObject, readStorageObject, writeStorageObject } from "./storage";

interface AssetRow {
  material_type: MaterialType;
  source_storage_key: string;
}

let generationQueue = Promise.resolve();

async function serializeGeneration<T>(work: () => Promise<T>): Promise<T> {
  const previous = generationQueue;
  let release: () => void = () => {};
  generationQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await work();
  } finally {
    release();
  }
}

export interface GeneratedFileRecord {
  id: string;
  storageKey: string;
  downloadFilename: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  generatedAt: number;
}

async function readObject(key: string): Promise<ArrayBuffer> {
  const bytes = await readStorageObject(key);
  if (!bytes) throw new HttpError(500, "资料文件暂时不可用，请联系小圆", "SOURCE_FILE_MISSING");
  return bytes;
}

async function generateBuyerFileInternal(
  materialVersionId: string,
  entry: ProductEntry,
  bindingId: string,
  jobId: string,
  phone: string,
): Promise<GeneratedFileRecord> {
  const assets = await all<AssetRow>(
    "SELECT material_type, source_storage_key FROM material_assets WHERE material_version_id = ? AND validation_status = 'VALID'",
    materialVersionId,
  );
  const assetMap = new Map(assets.map((asset) => [asset.material_type, asset.source_storage_key]));
  const required = entry === "BUNDLE" ? MATERIAL_TYPES : [entry as MaterialType];
  for (const type of required) if (!assetMap.has(type)) throw new HttpError(500, "资料文件不完整，请联系小圆", "SOURCE_FILE_MISSING");

  let bytes: Uint8Array;
  if (entry === "BUNDLE") {
    const watermarked = {} as Record<MaterialType, Uint8Array>;
    for (const type of MATERIAL_TYPES) watermarked[type] = await addPhoneWatermark(await readObject(assetMap.get(type)!), phone);
    bytes = await buildBundle(watermarked);
  } else {
    bytes = await addPhoneWatermark(await readObject(assetMap.get(entry as MaterialType)!), phone);
  }

  const generatedAt = Date.now();
  const extension = entry === "BUNDLE" ? "zip" : "pdf";
  const storageKey = `materials/${materialVersionId}/generated/${entry}/${bindingId}/${randomId()}.${extension}`;
  const mimeType = outputMimeType(entry);
  await writeStorageObject(storageKey, bytes);
  const previous = await first<{ storage_key: string }>(
    "SELECT storage_key FROM generated_files WHERE generation_job_id = ?",
    jobId,
  );

  const record: GeneratedFileRecord = {
    id: randomId(),
    storageKey,
    downloadFilename: DOWNLOAD_NAMES[entry],
    mimeType,
    fileSize: bytes.byteLength,
    checksum: await sha256Bytes(bytes),
    generatedAt,
  };
  try {
    await run(
      `INSERT INTO generated_files (
        id, generation_job_id, storage_key, download_filename, mime_type, file_size, checksum,
        generated_at, archive_at, archived_at, archive_storage_key, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'ACTIVE')
      ON CONFLICT(generation_job_id) DO UPDATE SET
        id = excluded.id,
        storage_key = excluded.storage_key,
        download_filename = excluded.download_filename,
        mime_type = excluded.mime_type,
        file_size = excluded.file_size,
        checksum = excluded.checksum,
        generated_at = excluded.generated_at,
        archive_at = excluded.archive_at,
        archived_at = NULL,
        archive_storage_key = NULL,
        status = 'ACTIVE'`,
      record.id, jobId, record.storageKey, record.downloadFilename, record.mimeType, record.fileSize,
      record.checksum, record.generatedAt, record.generatedAt + FILE_RETENTION_MS,
    );
  } catch (error) {
    await deleteStorageObject(storageKey);
    throw error;
  }
  if (previous?.storage_key && previous.storage_key !== storageKey) await deleteStorageObject(previous.storage_key);
  return record;
}

export async function generateBuyerFile(
  materialVersionId: string,
  entry: ProductEntry,
  bindingId: string,
  jobId: string,
  phone: string,
): Promise<GeneratedFileRecord> {
  return serializeGeneration(() => generateBuyerFileInternal(materialVersionId, entry, bindingId, jobId, phone));
}

export async function archiveExpiredFiles(now = Date.now()): Promise<{ generated: number; sources: number }> {
  const generatedFiles = await all<{ id: string; storage_key: string; archive_storage_key: string | null }>(
    "SELECT id, storage_key, archive_storage_key FROM generated_files WHERE status = 'ACTIVE' AND archive_at <= ? LIMIT 100",
    now,
  );
  let generated = 0;
  for (const file of generatedFiles) {
    const archiveKey = file.storage_key.replace(/^materials\//, "old-sold/");
    if (!await moveStorageObject(file.storage_key, archiveKey)) {
      await run("UPDATE generated_files SET status = 'MISSING', archived_at = ? WHERE id = ?", now, file.id);
      continue;
    }
    await run(
      "UPDATE generated_files SET status = 'ARCHIVED', archived_at = ?, archive_storage_key = ? WHERE id = ?",
      now, archiveKey, file.id,
    );
    generated += 1;
  }

  const sourceAssets = await all<{ id: string; source_storage_key: string; material_version_id: string }>(
    `SELECT ma.id, ma.source_storage_key, ma.material_version_id
     FROM material_assets ma JOIN material_versions mv ON mv.id = ma.material_version_id
     WHERE mv.expires_at <= ? AND ma.source_storage_key LIKE 'materials/%' LIMIT 100`,
    now,
  );
  let sources = 0;
  for (const asset of sourceAssets) {
    const historyKey = asset.source_storage_key.replace(/^materials\//, "history/");
    if (!await moveStorageObject(asset.source_storage_key, historyKey)) continue;
    await run("UPDATE material_assets SET source_storage_key = ? WHERE id = ?", historyKey, asset.id);
    sources += 1;
  }
  return { generated, sources };
}
