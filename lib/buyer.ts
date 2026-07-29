import type { LinkRecord } from "./links";
import { createBuyerSession, phaseOf } from "./links";
import { isValidOrderNumber, isValidPhone, normalizeOrderNumber, normalizePhone } from "./domain";
import { batch, first, run } from "./db";
import { HttpError, requestIsSecure } from "./http";
import { randomId } from "./crypto";
import { generateBuyerFile } from "./files";
import { issueOtp, verifyAndConsumeOtp } from "./sms";
import { getEnv } from "./runtime";
import { storageObjectMatches } from "./storage";

interface BindingRow {
  id: string;
  phone: string;
  order_number: string;
}

interface ExistingFileRow {
  job_id: string;
  job_status: string;
  file_id: string | null;
  storage_key: string | null;
  download_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  generated_at: number | null;
  started_at: number | null;
}

export async function canPhoneDownload(link: LinkRecord, phone: string): Promise<boolean> {
  const record = await first<{ id: string }>(
    `SELECT gf.id FROM buyer_bindings bb
     JOIN generation_jobs gj ON gj.buyer_binding_id = bb.id AND gj.status = 'SUCCEEDED'
     JOIN generated_files gf ON gf.generation_job_id = gj.id AND gf.status = 'ACTIVE'
     WHERE bb.material_version_id = ? AND bb.product_entry = ? AND bb.phone = ?`,
    link.materialVersionId, link.productEntry, phone,
  );
  return Boolean(record);
}

export async function sendBuyerCode(link: LinkRecord, rawPhone: unknown, ip: string): Promise<{ devCode?: string }> {
  const phone = normalizePhone(rawPhone);
  if (!isValidPhone(phone)) throw new HttpError(400, "请输入正确的中国大陆手机号", "INVALID_PHONE");
  const phase = phaseOf(link);
  if (phase === "EXPIRED") throw new HttpError(410, "链接已失效，有问题请直接联系小圆", "LINK_EXPIRED");
  if (phase === "DOWNLOAD_ONLY" && !await canPhoneDownload(link, phone)) {
    throw new HttpError(403, "本期资料的专属文件生成时间已经结束，仅限此前成功生成过文件的用户登录下载。", "GENERATION_CLOSED");
  }
  return issueOtp(phone, ip);
}

async function findExistingFile(bindingId: string): Promise<ExistingFileRow | null> {
  return first<ExistingFileRow>(
    `SELECT gj.id AS job_id, gj.status AS job_status, gj.started_at, gf.id AS file_id, gf.storage_key,
      gf.download_filename, gf.mime_type, gf.file_size, gf.generated_at
     FROM generation_jobs gj LEFT JOIN generated_files gf ON gf.generation_job_id = gj.id AND gf.status = 'ACTIVE'
     WHERE gj.buyer_binding_id = ?`,
    bindingId,
  );
}

async function reconcileExistingFile(existing: ExistingFileRow): Promise<ExistingFileRow> {
  const complete = Boolean(existing.file_id && existing.storage_key && existing.file_size !== null);
  if (complete && await storageObjectMatches(existing.storage_key!, existing.file_size!)) return existing;
  if (existing.job_status !== "SUCCEEDED" && !existing.file_id) return existing;

  const now = Date.now();
  const updates: Array<{ sql: string; values: Array<string | number> }> = [];
  if (existing.file_id) {
    updates.push({
      sql: "UPDATE generated_files SET status = 'MISSING', archived_at = ? WHERE id = ? AND status = 'ACTIVE'",
      values: [now, existing.file_id],
    });
  }
  updates.push({
    sql: "UPDATE generation_jobs SET status = 'FAILED', error_code = 'FILE_MISSING', completed_at = ? WHERE id = ?",
    values: [now, existing.job_id],
  });
  await batch(updates);
  return {
    ...existing,
    job_status: "FAILED",
    file_id: null,
    storage_key: null,
    download_filename: null,
    mime_type: null,
    file_size: null,
    generated_at: null,
  };
}

export interface AccessResult {
  state: "READY" | "GENERATING";
  cookie?: string;
  filename?: string;
  generatedAt?: number;
}

export async function accessBuyerFile(
  request: Request,
  link: LinkRecord,
  rawPhone: unknown,
  rawCode: unknown,
  rawOrderNumber: unknown,
): Promise<AccessResult> {
  const secureCookie = requestIsSecure(request);
  const phone = normalizePhone(rawPhone);
  const code = String(rawCode ?? "").trim();
  const orderNumber = normalizeOrderNumber(rawOrderNumber);
  if (!isValidPhone(phone)) throw new HttpError(400, "请输入正确的中国大陆手机号", "INVALID_PHONE");
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, "请输入6位短信验证码", "INVALID_OTP_FORMAT");
  if (!isValidOrderNumber(orderNumber)) throw new HttpError(400, "订单号应为 P 开头加18位数字", "INVALID_ORDER_NUMBER");

  const phase = phaseOf(link);
  if (phase === "EXPIRED") throw new HttpError(410, "链接已失效，有问题请直接联系小圆", "LINK_EXPIRED");

  const [phoneBinding, orderBinding] = await Promise.all([
    first<BindingRow>(
      "SELECT id, phone, order_number FROM buyer_bindings WHERE material_version_id = ? AND product_entry = ? AND phone = ?",
      link.materialVersionId, link.productEntry, phone,
    ),
    first<BindingRow>(
      "SELECT id, phone, order_number FROM buyer_bindings WHERE material_version_id = ? AND product_entry = ? AND order_number = ?",
      link.materialVersionId, link.productEntry, orderNumber,
    ),
  ]);
  if (phoneBinding && phoneBinding.order_number !== orderNumber) {
    throw new HttpError(409, "该手机号已经绑定过订单号，请使用首次提交的订单号。如填写有误，请联系小圆。", "PHONE_ALREADY_BOUND");
  }
  if (orderBinding && orderBinding.phone !== phone) {
    throw new HttpError(409, "该订单号已经绑定过手机号，请使用首次绑定的手机号。如有问题，请联系小圆。", "ORDER_ALREADY_BOUND");
  }

  const binding = phoneBinding ?? orderBinding;
  if (!binding && phase !== "GENERATION_OPEN") {
    throw new HttpError(403, "本期资料的专属文件生成时间已经结束，仅限此前成功生成过文件的用户登录下载。", "GENERATION_CLOSED");
  }

  await verifyAndConsumeOtp(phone, code);

  let bindingId = binding?.id;
  if (!bindingId) {
    bindingId = randomId();
    try {
      await run(
        `INSERT INTO buyer_bindings (id, material_version_id, product_entry, phone, order_number, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
        bindingId, link.materialVersionId, link.productEntry, phone, orderNumber, Date.now(),
      );
    } catch {
      const concurrent = await first<BindingRow>(
        `SELECT id, phone, order_number FROM buyer_bindings
         WHERE material_version_id = ? AND product_entry = ? AND (phone = ? OR order_number = ?)`,
        link.materialVersionId, link.productEntry, phone, orderNumber,
      );
      if (!concurrent || concurrent.phone !== phone || concurrent.order_number !== orderNumber) {
        throw new HttpError(409, "手机号或订单号已经被绑定，请联系小圆", "BINDING_CONFLICT");
      }
      bindingId = concurrent.id;
    }
  }

  let existing = await findExistingFile(bindingId);
  if (existing) existing = await reconcileExistingFile(existing);
  if (existing?.file_id && existing.download_filename && existing.generated_at) {
    if (existing.job_status !== "SUCCEEDED") {
      await run("UPDATE generation_jobs SET status = 'SUCCEEDED', completed_at = ?, error_code = NULL WHERE id = ?", Date.now(), existing.job_id);
    }
    const session = await createBuyerSession(bindingId, link, secureCookie);
    return { state: "READY", cookie: session.header, filename: existing.download_filename!, generatedAt: existing.generated_at! };
  }
  if (phase !== "GENERATION_OPEN") throw new HttpError(403, "专属文件生成时间已经结束，请联系小圆", "GENERATION_CLOSED");

  if (!existing) {
    const jobId = randomId();
    try {
      await run(
        `INSERT INTO generation_jobs (id, buyer_binding_id, status, error_code, attempt_count, created_at, started_at, completed_at)
         VALUES (?, ?, 'PENDING', NULL, 0, ?, NULL, NULL)`,
        jobId, bindingId, Date.now(),
      );
    } catch {
      // A concurrent request may have created the unique job.
    }
    existing = await findExistingFile(bindingId);
  }
  if (!existing) throw new HttpError(500, "生成任务创建失败，请稍后重试", "JOB_CREATE_FAILED");
  if (existing.job_status === "PROCESSING" && existing.started_at && existing.started_at < Date.now() - 10 * 60 * 1000) {
    await run("UPDATE generation_jobs SET status = 'FAILED', error_code = 'STALE_JOB', completed_at = ? WHERE id = ? AND status = 'PROCESSING'", Date.now(), existing.job_id);
    existing.job_status = "FAILED";
  }
  if (existing.job_status === "PROCESSING") {
    const session = await createBuyerSession(bindingId, link, secureCookie);
    return { state: "GENERATING", cookie: session.header };
  }

  const claimed = await run(
    `UPDATE generation_jobs SET status = 'PROCESSING', error_code = NULL,
      attempt_count = attempt_count + 1, started_at = ?, completed_at = NULL
     WHERE id = ? AND status IN ('PENDING', 'FAILED')`,
    Date.now(), existing.job_id,
  );
  if ((claimed.meta.changes ?? 0) < 1) {
    const session = await createBuyerSession(bindingId, link, secureCookie);
    return { state: "GENERATING", cookie: session.header };
  }

  try {
    const file = await generateBuyerFile(link.materialVersionId, link.productEntry, bindingId, existing.job_id, phone);
    if (!await storageObjectMatches(file.storageKey, file.fileSize)) {
      await run("UPDATE generated_files SET status = 'MISSING', archived_at = ? WHERE id = ?", Date.now(), file.id);
      throw new HttpError(500, "专属文件写入失败，请稍后重试", "GENERATED_FILE_MISSING");
    }
    await run("UPDATE generation_jobs SET status = 'SUCCEEDED', completed_at = ?, error_code = NULL WHERE id = ?", Date.now(), existing.job_id);
    const session = await createBuyerSession(bindingId, link, secureCookie);
    return { state: "READY", cookie: session.header, filename: file.downloadFilename, generatedAt: file.generatedAt };
  } catch (error) {
    await run("UPDATE generation_jobs SET status = 'FAILED', completed_at = ?, error_code = ? WHERE id = ?", Date.now(), "GENERATION_FAILED", existing.job_id);
    if (getEnv().ENVIRONMENT !== "production" && error instanceof Error) {
      throw new HttpError(500, `开发环境生成错误：${error.message}`, "GENERATION_FAILED");
    }
    throw error;
  }
}
