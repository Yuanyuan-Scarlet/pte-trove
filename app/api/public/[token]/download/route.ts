import { getEnv } from "@/lib/runtime";
import { errorResponse, HttpError } from "@/lib/http";
import { findLink, getBuyerAccess, phaseOf } from "@/lib/links";

function attachmentName(filename: string): string {
  return `attachment; filename="pte-material.${filename.endsWith(".zip") ? "zip" : "pdf"}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const link = await findLink(token);
    if (phaseOf(link) === "EXPIRED") throw new HttpError(410, "链接已失效，有问题请直接联系小圆", "LINK_EXPIRED");
    const access = await getBuyerAccess(request, link);
    if (!access) throw new HttpError(401, "请先验证手机号和订单号", "BUYER_AUTH_REQUIRED");
    const object = await getEnv().FILES.get(access.storageKey);
    if (!object) throw new HttpError(404, "文件暂时无法下载，请联系小圆处理", "FILE_NOT_FOUND");
    return new Response(object.body, {
      headers: {
        "content-type": access.mimeType,
        "content-length": String(object.size),
        "content-disposition": attachmentName(access.downloadFilename),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
