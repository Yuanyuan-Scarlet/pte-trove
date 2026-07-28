import { accessBuyerFile } from "@/lib/buyer";
import { assertSameOrigin, errorResponse, json, readJson } from "@/lib/http";
import { findLink } from "@/lib/links";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    assertSameOrigin(request);
    const { token } = await context.params;
    const body = await readJson<{ phone?: string; code?: string; orderNumber?: string }>(request);
    const result = await accessBuyerFile(request, await findLink(token), body.phone, body.code, body.orderNumber);
    const headers = result.cookie ? { "set-cookie": result.cookie } : undefined;
    return json({ state: result.state, filename: result.filename, generatedAt: result.generatedAt }, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
