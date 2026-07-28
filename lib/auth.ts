import { ADMIN_SESSION_MS } from "./constants";
import { constantTimeEqual, randomId, randomToken, sha256 } from "./crypto";
import { first, run } from "./db";
import { cookie, HttpError, parseCookies } from "./http";
import { getEnv } from "./runtime";

export const ADMIN_COOKIE = "pte_admin_session";

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeBase64(value: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifyPbkdf2(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationsRaw, saltRaw, expected] = encoded.split("$");
  const iterations = Number(iterationsRaw);
  if (algorithm !== "pbkdf2" || !Number.isInteger(iterations) || iterations < 100_000 || !saltRaw || !expected) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = decodeBase64(saltRaw);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer, iterations },
    key,
    256,
  );
  return constantTimeEqual(encodeBase64(derived), expected);
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  const env = getEnv();
  if (!env.ADMIN_USERNAME) throw new HttpError(503, "管理员账号尚未配置", "ADMIN_NOT_CONFIGURED");
  const usernameValid = constantTimeEqual(username, env.ADMIN_USERNAME);
  if (!usernameValid) return false;
  if (env.ADMIN_PASSWORD_HASH) return verifyPbkdf2(password, env.ADMIN_PASSWORD_HASH);
  if (env.ADMIN_PASSWORD && env.ENVIRONMENT !== "production") return constantTimeEqual(password, env.ADMIN_PASSWORD);
  throw new HttpError(503, "管理员密码尚未配置", "ADMIN_NOT_CONFIGURED");
}

export async function assertAdminLoginAllowed(ip: string): Promise<void> {
  const since = Date.now() - 15 * 60 * 1000;
  const failures = await first<{ count: number }>(
    "SELECT COUNT(*) AS count FROM admin_login_attempts WHERE ip = ? AND succeeded = 0 AND created_at >= ?",
    ip, since,
  );
  if ((failures?.count ?? 0) >= 10) throw new HttpError(429, "登录尝试次数过多，请稍后再试", "ADMIN_RATE_LIMITED");
}

export async function recordAdminLoginAttempt(ip: string, succeeded: boolean): Promise<void> {
  await run(
    "INSERT INTO admin_login_attempts (id, ip, succeeded, created_at) VALUES (?, ?, ?, ?)",
    randomId(), ip, succeeded ? 1 : 0, Date.now(),
  );
}

export async function createAdminSession(): Promise<{ token: string; expiresAt: number }> {
  const token = randomToken();
  const now = Date.now();
  const expiresAt = now + ADMIN_SESSION_MS;
  await run(
    "INSERT INTO admin_sessions (id, token_hash, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, NULL)",
    randomId(), await sha256(token), now, expiresAt,
  );
  return { token, expiresAt };
}

export function adminSessionCookie(token: string, expiresAt: number, secure = true): string {
  return cookie(ADMIN_COOKIE, token, (expiresAt - Date.now()) / 1000, "Strict", secure);
}

export async function requireAdmin(request: Request): Promise<void> {
  const token = parseCookies(request).get(ADMIN_COOKIE);
  if (!token) throw new HttpError(401, "请先登录管理后台", "ADMIN_AUTH_REQUIRED");
  const session = await first<{ id: string }>(
    "SELECT id FROM admin_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?",
    await sha256(token), Date.now(),
  );
  if (!session) throw new HttpError(401, "管理员登录已失效，请重新登录", "ADMIN_SESSION_EXPIRED");
}

export async function revokeAdminSession(request: Request): Promise<void> {
  const token = parseCookies(request).get(ADMIN_COOKIE);
  if (token) await run("UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ?", Date.now(), await sha256(token));
}

export function clearAdminCookie(secure = true): string {
  return cookie(ADMIN_COOKIE, "", 0, "Strict", secure);
}
