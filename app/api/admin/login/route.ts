import { adminSessionCookie, assertAdminLoginAllowed, assertAdminRoute, createAdminSession, recordAdminLoginAttempt, verifyAdminCredentials } from "@/lib/auth";
import { assertSameOrigin, clientIp, errorResponse, json, readJson, requestIsSecure } from "@/lib/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson<{ routeKey?: string; username?: string; password?: string }>(request);
    assertAdminRoute(String(body.routeKey ?? ""));
    const ip = clientIp(request);
    await assertAdminLoginAllowed(ip);
    const valid = await verifyAdminCredentials(String(body.username ?? ""), String(body.password ?? ""));
    await recordAdminLoginAttempt(ip, valid);
    if (!valid) {
      return json({ error: "账号或密码错误", code: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    const session = await createAdminSession();
    return json({ ok: true }, { headers: { "set-cookie": adminSessionCookie(session.token, session.expiresAt, requestIsSecure(request)) } });
  } catch (error) {
    return errorResponse(error);
  }
}
