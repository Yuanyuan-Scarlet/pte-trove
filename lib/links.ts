import { getLinkPhase, type LinkPhase } from "./domain";
import { batch, first, run } from "./db";
import { HttpError, parseCookies, cookie } from "./http";
import { randomId, randomToken, seal, sha256, unseal } from "./crypto";
import type { ProductEntry } from "./constants";
import { storageObjectMatches } from "./storage";

export interface LinkRecord {
  linkId: string;
  materialVersionId: string;
  displayName: string;
  productEntry: ProductEntry;
  publishedAt: number;
  generationDeadline: number;
  expiresAt: number;
}

interface LinkRow {
  link_id: string;
  material_version_id: string;
  display_name: string;
  product_entry: ProductEntry;
  published_at: number;
  generation_deadline: number;
  expires_at: number;
}

export async function findLink(token: string): Promise<LinkRecord> {
  const row = await first<LinkRow>(
    `SELECT pl.id AS link_id, pl.material_version_id, mv.display_name, pl.product_entry,
      mv.published_at, mv.generation_deadline, mv.expires_at
    FROM product_links pl JOIN material_versions mv ON mv.id = pl.material_version_id
    WHERE pl.token_hash = ? AND mv.status = 'PUBLISHED'`,
    await sha256(token),
  );
  if (!row) throw new HttpError(404, "资料链接不存在或已失效", "LINK_NOT_FOUND");
  return {
    linkId: row.link_id,
    materialVersionId: row.material_version_id,
    displayName: row.display_name,
    productEntry: row.product_entry,
    publishedAt: row.published_at,
    generationDeadline: row.generation_deadline,
    expiresAt: row.expires_at,
  };
}

export function phaseOf(link: LinkRecord, now = Date.now()): LinkPhase {
  return getLinkPhase(link.publishedAt, link.generationDeadline, link.expiresAt, now);
}

export function buyerCookieName(linkId: string): string {
  return `pte_buyer_${linkId.replace(/-/g, "")}`;
}

export async function createBuyerSession(bindingId: string, link: LinkRecord, secure = true): Promise<{ header: string; expiresAt: number }> {
  const token = randomToken();
  const now = Date.now();
  const expiresAt = link.expiresAt;
  await run(
    "INSERT INTO buyer_sessions (id, buyer_binding_id, token_hash, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)",
    randomId(), bindingId, await sha256(token), now, expiresAt,
  );
  return { header: cookie(buyerCookieName(link.linkId), token, (expiresAt - now) / 1000, "Lax", secure), expiresAt };
}

export interface BuyerAccess {
  bindingId: string;
  phone: string;
  orderNumber: string;
  fileId: string;
  storageKey: string;
  downloadFilename: string;
  mimeType: string;
  generatedAt: number;
}

export interface BuyerSessionState {
  bindingId: string;
  phone: string;
  orderNumber: string;
  jobId: string | null;
  jobStatus: string | null;
  fileId: string | null;
  storageKey: string | null;
  downloadFilename: string | null;
  mimeType: string | null;
  fileSize: number | null;
  generatedAt: number | null;
}

export async function getBuyerSessionState(request: Request, link: LinkRecord): Promise<BuyerSessionState | null> {
  if (phaseOf(link) === "EXPIRED") return null;
  const token = parseCookies(request).get(buyerCookieName(link.linkId));
  if (!token) return null;
  const state = await first<BuyerSessionState>(
    `SELECT bb.id AS bindingId, bb.phone, bb.order_number AS orderNumber,
      gj.id AS jobId, gj.status AS jobStatus, gf.id AS fileId, gf.storage_key AS storageKey,
      gf.download_filename AS downloadFilename, gf.mime_type AS mimeType, gf.file_size AS fileSize,
      gf.generated_at AS generatedAt
    FROM buyer_sessions bs
    JOIN buyer_bindings bb ON bb.id = bs.buyer_binding_id
    LEFT JOIN generation_jobs gj ON gj.buyer_binding_id = bb.id
    LEFT JOIN generated_files gf ON gf.generation_job_id = gj.id AND gf.status = 'ACTIVE'
    WHERE bs.token_hash = ? AND bs.revoked_at IS NULL AND bs.expires_at > ?
      AND bb.material_version_id = ? AND bb.product_entry = ?`,
    await sha256(token), Date.now(), link.materialVersionId, link.productEntry,
  );
  if (!state || state.jobStatus !== "SUCCEEDED") return state;

  const available = Boolean(state.fileId && state.storageKey && state.fileSize !== null)
    && await storageObjectMatches(state.storageKey!, state.fileSize!);
  if (available) return state;

  const now = Date.now();
  const updates: Array<{ sql: string; values: Array<string | number> }> = [];
  if (state.fileId) {
    updates.push({
      sql: "UPDATE generated_files SET status = 'MISSING', archived_at = ? WHERE id = ? AND status = 'ACTIVE'",
      values: [now, state.fileId],
    });
  }
  if (state.jobId) {
    updates.push({
      sql: "UPDATE generation_jobs SET status = 'FAILED', error_code = 'FILE_MISSING', completed_at = ? WHERE id = ?",
      values: [now, state.jobId],
    });
  }
  if (updates.length) await batch(updates);
  return {
    ...state,
    jobStatus: "FAILED",
    fileId: null,
    storageKey: null,
    downloadFilename: null,
    mimeType: null,
    fileSize: null,
    generatedAt: null,
  };
}

export async function getBuyerAccess(request: Request, link: LinkRecord): Promise<BuyerAccess | null> {
  const state = await getBuyerSessionState(request, link);
  if (!state || state.jobStatus !== "SUCCEEDED" || !state.fileId || !state.storageKey || !state.downloadFilename || !state.mimeType || !state.generatedAt) return null;
  return {
    bindingId: state.bindingId,
    phone: state.phone,
    orderNumber: state.orderNumber,
    fileId: state.fileId,
    storageKey: state.storageKey,
    downloadFilename: state.downloadFilename,
    mimeType: state.mimeType,
    generatedAt: state.generatedAt,
  };
}

export async function publishProductLinks(
  materialVersionId: string,
  publishedAt: number,
  generationDeadline: number,
  expiresAt: number,
): Promise<Array<{ entry: ProductEntry; token: string }>> {
  const entries = ["WFD", "DI", "SST", "RS", "WE", "BUNDLE"] as ProductEntry[];
  const createdAt = Date.now();
  const output: Array<{ entry: ProductEntry; token: string }> = [];
  const inserts: Array<{ sql: string; values: Array<string | number> }> = [];
  for (const entry of entries) {
    const token = randomToken(32);
    inserts.push({
      sql: `INSERT INTO product_links (id, material_version_id, product_entry, token_ciphertext, token_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      values: [randomId(), materialVersionId, entry, await seal(token), await sha256(token), createdAt],
    });
    output.push({ entry, token });
  }
  inserts.push({
    sql: `UPDATE material_versions SET status = 'PUBLISHED', published_at = ?, generation_deadline = ?, expires_at = ?
      WHERE id = ? AND status = 'DRAFT'`,
    values: [publishedAt, generationDeadline, expiresAt, materialVersionId],
  });
  await batch(inserts);
  return output;
}

export async function listProductLinks(materialVersionId: string): Promise<Array<{ entry: ProductEntry; token: string }>> {
  const rows = await import("./db").then(({ all }) => all<{ product_entry: ProductEntry; token_ciphertext: string }>(
    "SELECT product_entry, token_ciphertext FROM product_links WHERE material_version_id = ? ORDER BY product_entry",
    materialVersionId,
  ));
  return Promise.all(rows.map(async (row) => ({ entry: row.product_entry, token: await unseal(row.token_ciphertext) })));
}
