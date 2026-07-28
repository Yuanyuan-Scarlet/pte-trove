import { ENTRY_META } from "@/lib/constants";
import { errorResponse, json } from "@/lib/http";
import { findLink, getBuyerSessionState, phaseOf } from "@/lib/links";
import { maskPhone } from "@/lib/domain";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const link = await findLink(token);
    const phase = phaseOf(link);
    const session = await getBuyerSessionState(request, link);
    return json({
      entry: link.productEntry,
      entryMeta: ENTRY_META[link.productEntry],
      versionName: link.displayName,
      phase,
      publishedAt: link.publishedAt,
      generationDeadline: link.generationDeadline,
      expiresAt: link.expiresAt,
      authenticated: Boolean(session),
      phone: session ? maskPhone(session.phone) : null,
      jobStatus: session?.jobStatus ?? null,
      ready: session?.jobStatus === "SUCCEEDED" && Boolean(session.fileId),
      filename: session?.downloadFilename ?? null,
      generatedAt: session?.generatedAt ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
