import { publishVersion } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin, errorResponse, json } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    assertSameOrigin(request);
    await requireAdmin(request);
    const { versionId } = await context.params;
    const result = await publishVersion(versionId);
    const origin = new URL(request.url).origin;
    return json({ ...result, links: result.links.map((link) => ({ entry: link.entry, url: `${origin}/g/${link.token}` })) });
  } catch (error) {
    return errorResponse(error);
  }
}
