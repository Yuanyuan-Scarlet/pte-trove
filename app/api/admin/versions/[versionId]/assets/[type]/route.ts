import { uploadAsset } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { MATERIAL_TYPES, type MaterialType } from "@/lib/constants";
import { assertSameOrigin, errorResponse, HttpError, json } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ versionId: string; type: string }> }) {
  try {
    assertSameOrigin(request);
    await requireAdmin(request);
    const { versionId, type } = await context.params;
    if (!MATERIAL_TYPES.includes(type as MaterialType)) throw new HttpError(400, "未知资料类型", "INVALID_MATERIAL_TYPE");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "请选择 PDF 文件", "FILE_REQUIRED");
    return json({ asset: await uploadAsset(versionId, type as MaterialType, file) });
  } catch (error) {
    return errorResponse(error);
  }
}
