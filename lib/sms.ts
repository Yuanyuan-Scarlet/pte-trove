import {
  OTP_DAILY_LIMIT,
  OTP_HOURLY_LIMIT,
  OTP_IP_DAILY_LIMIT,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_MS,
  OTP_TTL_MS,
} from "./constants";
import { hmacSha1Base64, randomId, sha256 } from "./crypto";
import { first, run } from "./db";
import { HttpError } from "./http";
import { getEnv, requireSecret } from "./runtime";

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function sixDigitCode(): string {
  const values = crypto.getRandomValues(new Uint32Array(1));
  return String(values[0] % 1_000_000).padStart(6, "0");
}

async function codeHash(phone: string, code: string): Promise<string> {
  return sha256(`${phone}:${code}:${requireSecret("APP_SECRET")}`);
}

async function sendAliyunSms(phone: string, code: string): Promise<void> {
  const env = getEnv();
  if (env.SMS_MODE === "mock") {
    if (env.ENVIRONMENT === "production") throw new HttpError(503, "短信服务配置异常", "SMS_NOT_CONFIGURED");
    return;
  }
  const accessKeyId = env.ALIBABA_CLOUD_SMS_ACCESS_KEY_ID;
  const accessKeySecret = env.ALIBABA_CLOUD_SMS_ACCESS_KEY_SECRET;
  const signName = env.SMS_SIGN_NAME;
  const templateCode = env.SMS_TEMPLATE_CODE;
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) throw new HttpError(503, "短信服务尚未配置", "SMS_NOT_CONFIGURED");

  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: phone,
    RegionId: env.SMS_REGION_ID ?? "cn-hangzhou",
    SignName: signName,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ [env.SMS_TEMPLATE_VARIABLE ?? "code"]: code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25",
  };
  const canonical = Object.keys(params).sort().map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`).join("&");
  params.Signature = await hmacSha1Base64(`${accessKeySecret}&`, `POST&%2F&${percentEncode(canonical)}`);
  const response = await fetch("https://dysmsapi.aliyuncs.com", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (!response.ok) throw new HttpError(502, "验证码发送失败，请稍后重试", "SMS_PROVIDER_ERROR");
  const result = await response.json() as { Code?: string };
  if (result.Code !== "OK") throw new HttpError(502, "验证码发送失败，请稍后重试", "SMS_PROVIDER_ERROR");
}

export async function issueOtp(phone: string, ip: string): Promise<{ devCode?: string }> {
  const now = Date.now();
  const latest = await first<{ created_at: number }>(
    "SELECT created_at FROM otp_challenges WHERE phone = ? ORDER BY created_at DESC LIMIT 1",
    phone,
  );
  if (latest && now - latest.created_at < OTP_RESEND_MS) throw new HttpError(429, "验证码已发送，请稍后再试", "OTP_TOO_FREQUENT");

  const [hourCount, dayCount, ipCount] = await Promise.all([
    first<{ count: number }>("SELECT COUNT(*) AS count FROM otp_challenges WHERE phone = ? AND created_at >= ?", phone, now - 60 * 60 * 1000),
    first<{ count: number }>("SELECT COUNT(*) AS count FROM otp_challenges WHERE phone = ? AND created_at >= ?", phone, now - 24 * 60 * 60 * 1000),
    first<{ count: number }>("SELECT COUNT(*) AS count FROM otp_challenges WHERE ip = ? AND created_at >= ?", ip, now - 24 * 60 * 60 * 1000),
  ]);
  if ((hourCount?.count ?? 0) >= OTP_HOURLY_LIMIT || (dayCount?.count ?? 0) >= OTP_DAILY_LIMIT || (ipCount?.count ?? 0) >= OTP_IP_DAILY_LIMIT) {
    throw new HttpError(429, "获取验证码次数过多，请稍后再试", "OTP_RATE_LIMITED");
  }

  const code = sixDigitCode();
  const id = randomId();
  await run(
    `INSERT INTO otp_challenges (id, phone, code_hash, purpose, ip, expires_at, attempt_count, consumed_at, created_at)
     VALUES (?, ?, ?, 'BUYER_ACCESS', ?, ?, 0, NULL, ?)`,
    id, phone, await codeHash(phone, code), ip, now + OTP_TTL_MS, now,
  );
  try {
    await sendAliyunSms(phone, code);
  } catch (error) {
    await run("DELETE FROM otp_challenges WHERE id = ?", id);
    throw error;
  }
  return getEnv().SMS_MODE === "mock" && getEnv().ENVIRONMENT !== "production" ? { devCode: code } : {};
}

export async function verifyAndConsumeOtp(phone: string, code: string): Promise<void> {
  const now = Date.now();
  const challenge = await first<{ id: string; code_hash: string; attempt_count: number }>(
    `SELECT id, code_hash, attempt_count FROM otp_challenges
     WHERE phone = ? AND purpose = 'BUYER_ACCESS' AND consumed_at IS NULL AND expires_at > ?
     ORDER BY created_at DESC LIMIT 1`,
    phone, now,
  );
  if (!challenge) throw new HttpError(400, "验证码已失效，请重新获取", "OTP_EXPIRED");
  if (challenge.attempt_count >= OTP_MAX_ATTEMPTS) throw new HttpError(429, "验证码错误次数过多，请稍后再试", "OTP_LOCKED");
  if (challenge.code_hash !== await codeHash(phone, code)) {
    await run("UPDATE otp_challenges SET attempt_count = attempt_count + 1 WHERE id = ?", challenge.id);
    throw new HttpError(400, "验证码错误，请重试", "OTP_INVALID");
  }
  await run("UPDATE otp_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL", now, challenge.id);
}
