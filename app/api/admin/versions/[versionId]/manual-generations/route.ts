import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin, errorResponse, json, readJson } from "@/lib/http";
import { createManualGeneration, listManualGenerations } from "@/lib/manual";

export async function GET(request: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    await requireAdmin(request);
    const { versionId } = await context.params;
    return json({ records: await listManualGenerations(versionId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    assertSameOrigin(request);
    await requireAdmin(request);
    const { versionId } = await context.params;
    const body = await readJson<{ entry?: unknown; salutation?: unknown; phone?: unknown }>(request);
    const record = await createManualGeneration(versionId, body.entry, body.salutation, body.phone);
    return json({ record }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
