import { listAssets } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { errorResponse, json } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    await requireAdmin(request);
    const { versionId } = await context.params;
    return json({ assets: await listAssets(versionId) });
  } catch (error) {
    return errorResponse(error);
  }
}
