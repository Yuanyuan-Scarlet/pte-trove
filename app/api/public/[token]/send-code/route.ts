import { sendBuyerCode } from "@/lib/buyer";
import { assertSameOrigin, clientIp, errorResponse, json, readJson } from "@/lib/http";
import { findLink } from "@/lib/links";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    assertSameOrigin(request);
    const { token } = await context.params;
    const body = await readJson<{ phone?: string }>(request);
    const result = await sendBuyerCode(await findLink(token), body.phone, clientIp(request));
    return json({ message: "验证码已发送", ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
