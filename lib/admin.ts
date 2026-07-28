import { MATERIAL_TYPES, type MaterialType } from "./constants";
import { calculateDeadlines, getLinkPhase } from "./domain";
import { all, first, run } from "./db";
import { randomId, sha256Bytes } from "./crypto";
import { HttpError } from "./http";
import { inspectPdf } from "./pdf";
import { listProductLinks, publishProductLinks } from "./links";
import { getEnv } from "./runtime";

interface VersionRow {
  id: string;
  display_name: string;
  status: "DRAFT" | "PUBLISHED";
  created_at: number;
  published_at: number | null;
  generation_deadline: number | null;
  expires_at: number | null;
  asset_count: number;
  generation_count: number;
}

export async function createVersion(displayName?: string) {
  const now = Date.now();
  const id = randomId();
  const name = displayName?.trim() || `资料版本 ${new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(now)}`;
  await run(
    "INSERT INTO material_versions (id, display_name, status, created_at, published_at, generation_deadline, expires_at) VALUES (?, ?, 'DRAFT', ?, NULL, NULL, NULL)",
    id, name.slice(0, 100), now,
  );
  return { id, displayName: name, status: "DRAFT", createdAt: now };
}

export async function uploadAsset(versionId: string, type: MaterialType, file: File) {
  if (!MATERIAL_TYPES.includes(type)) throw new HttpError(400, "未知资料类型", "INVALID_MATERIAL_TYPE");
  const version = await first<{ status: string }>("SELECT status FROM material_versions WHERE id = ?", versionId);
  if (!version) throw new HttpError(404, "资料版本不存在", "VERSION_NOT_FOUND");
  if (version.status !== "DRAFT") throw new HttpError(409, "已发布资料不能替换", "VERSION_ALREADY_PUBLISHED");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new HttpError(400, "只支持 PDF 文件", "INVALID_FILE_TYPE");
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > 50 * 1024 * 1024) throw new HttpError(413, "单个 PDF 不能超过 50MB", "FILE_TOO_LARGE");
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  if (header !== "%PDF-") throw new HttpError(400, "文件内容不是有效 PDF", "INVALID_PDF");
  const { pageCount } = await inspectPdf(bytes);
  const storageKey = `materials/${versionId}/source/${type}.pdf`;
  await getEnv().FILES.put(storageKey, bytes, { httpMetadata: { contentType: "application/pdf" } });
  const now = Date.now();
  const checksum = await sha256Bytes(bytes);
  const existing = await first<{ id: string }>(
    "SELECT id FROM material_assets WHERE material_version_id = ? AND material_type = ?",
    versionId, type,
  );
  if (existing) {
    await run(
      `UPDATE material_assets SET source_storage_key = ?, original_filename = ?, file_size = ?, page_count = ?,
       checksum = ?, validation_status = 'VALID', created_at = ? WHERE id = ?`,
      storageKey, file.name.slice(0, 240), bytes.byteLength, pageCount, checksum, now, existing.id,
    );
  } else {
    await run(
      `INSERT INTO material_assets (id, material_version_id, material_type, source_storage_key, original_filename,
       file_size, page_count, checksum, validation_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'VALID', ?)`,
      randomId(), versionId, type, storageKey, file.name.slice(0, 240), bytes.byteLength, pageCount, checksum, now,
    );
  }
  return { type, filename: file.name, size: bytes.byteLength, pageCount, checksum };
}

export async function publishVersion(versionId: string) {
  const version = await first<{ status: string }>("SELECT status FROM material_versions WHERE id = ?", versionId);
  if (!version) throw new HttpError(404, "资料版本不存在", "VERSION_NOT_FOUND");
  if (version.status !== "DRAFT") throw new HttpError(409, "该资料版本已经发布", "VERSION_ALREADY_PUBLISHED");
  const assets = await all<{ material_type: MaterialType }>(
    "SELECT material_type FROM material_assets WHERE material_version_id = ? AND validation_status = 'VALID'",
    versionId,
  );
  const present = new Set(assets.map((asset) => asset.material_type));
  const missing = MATERIAL_TYPES.filter((type) => !present.has(type));
  if (missing.length) throw new HttpError(409, `请先上传：${missing.join("、")}`, "MISSING_ASSETS");

  const publishedAt = Date.now();
  const { generationDeadline, expiresAt } = calculateDeadlines(publishedAt);
  const links = await publishProductLinks(versionId, publishedAt, generationDeadline, expiresAt);
  return { publishedAt, generationDeadline, expiresAt, links };
}

export async function listVersions(origin: string) {
  const rows = await all<VersionRow>(
    `SELECT mv.id, mv.display_name, mv.status, mv.created_at, mv.published_at, mv.generation_deadline, mv.expires_at,
      COUNT(DISTINCT ma.id) AS asset_count,
      COUNT(DISTINCT CASE WHEN gj.status = 'SUCCEEDED' THEN gj.id END) AS generation_count
     FROM material_versions mv
     LEFT JOIN material_assets ma ON ma.material_version_id = mv.id
     LEFT JOIN buyer_bindings bb ON bb.material_version_id = mv.id
     LEFT JOIN generation_jobs gj ON gj.buyer_binding_id = bb.id
     GROUP BY mv.id ORDER BY mv.created_at DESC`,
  );
  return Promise.all(rows.map(async (row) => ({
    id: row.id,
    displayName: row.display_name,
    status: row.status === "DRAFT" ? "DRAFT" : getLinkPhase(row.published_at, row.generation_deadline, row.expires_at),
    createdAt: row.created_at,
    publishedAt: row.published_at,
    generationDeadline: row.generation_deadline,
    expiresAt: row.expires_at,
    assetCount: Number(row.asset_count),
    generationCount: Number(row.generation_count),
    links: row.status === "PUBLISHED"
      ? (await listProductLinks(row.id)).map((link) => ({ entry: link.entry, url: `${origin}/g/${link.token}` }))
      : [],
  })));
}

export async function listAssets(versionId: string) {
  return all<{ material_type: MaterialType; original_filename: string; file_size: number; page_count: number; checksum: string }>(
    "SELECT material_type, original_filename, file_size, page_count, checksum FROM material_assets WHERE material_version_id = ? ORDER BY material_type",
    versionId,
  );
}
