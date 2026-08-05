import { requireAdmin } from "@/lib/auth";
import { errorResponse, HttpError } from "@/lib/http";
import { getManualDownload } from "@/lib/manual";
import { openStorageObject } from "@/lib/storage";

function attachmentName(filename: string): string {
  return `attachment; filename="pte-manual.${filename.endsWith(".zip") ? "zip" : "pdf"}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request, context: { params: Promise<{ manualId: string }> }) {
  try {
    await requireAdmin(request);
    const { manualId } = await context.params;
    const download = await getManualDownload(manualId);
    const object = await openStorageObject(download.storageKey);
    if (!object) throw new HttpError(404, "文件暂时无法下载，请重新生成", "MANUAL_FILE_MISSING");
    return new Response(object.body, {
      headers: {
        "content-type": download.mimeType,
        "content-length": String(object.size),
        "content-disposition": attachmentName(download.downloadFilename),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
