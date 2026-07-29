import { createVersion, listVersions } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin, errorResponse, json, readJson, requestPublicOrigin } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return json({ versions: await listVersions(requestPublicOrigin(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireAdmin(request);
    const body = await readJson<{ displayName?: string }>(request);
    return json({ version: await createVersion(body.displayName) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
