import { clearAdminCookie, revokeAdminSession } from "@/lib/auth";
import { assertSameOrigin, errorResponse, json, requestIsSecure } from "@/lib/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await revokeAdminSession(request);
    return json({ ok: true }, { headers: { "set-cookie": clearAdminCookie(requestIsSecure(request)) } });
  } catch (error) {
    return errorResponse(error);
  }
}
