import { adminSessionCookie, assertAdminLoginAllowed, createAdminSession, recordAdminLoginAttempt, verifyAdminCredentials } from "@/lib/auth";
import { assertSameOrigin, clientIp, errorResponse, json, readJson } from "@/lib/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip = clientIp(request);
    await assertAdminLoginAllowed(ip);
    const body = await readJson<{ username?: string; password?: string }>(request);
    const valid = await verifyAdminCredentials(String(body.username ?? ""), String(body.password ?? ""));
    await recordAdminLoginAttempt(ip, valid);
    if (!valid) {
      return json({ error: "账号或密码错误", code: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    const session = await createAdminSession();
    return json({ ok: true }, { headers: { "set-cookie": adminSessionCookie(session.token, session.expiresAt, new URL(request.url).protocol === "https:") } });
  } catch (error) {
    return errorResponse(error);
  }
}
