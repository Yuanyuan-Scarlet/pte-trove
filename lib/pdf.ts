import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, degrees, rgb } from "pdf-lib";
import { zipSync } from "fflate";
import { DOWNLOAD_NAMES, MATERIAL_TYPES, type MaterialType, type ProductEntry } from "./constants";
import { HttpError } from "./http";

let fontBytesPromise: Promise<ArrayBuffer> | null = null;

async function getWatermarkFont(requestUrl: string): Promise<ArrayBuffer> {
  if (!fontBytesPromise) {
    const url = new URL("/fonts/noto-sans-sc-400.woff2", requestUrl);
    fontBytesPromise = fetch(url).then(async (response: Response) => {
      if (!response.ok) throw new Error("Watermark font asset unavailable");
      return response.arrayBuffer();
    }).catch((error: unknown) => {
      fontBytesPromise = null;
      throw error;
    });
  }
  return await fontBytesPromise;
}

export async function inspectPdf(bytes: ArrayBuffer): Promise<{ pageCount: number }> {
  try {
    const document = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
    const pageCount = document.getPageCount();
    if (pageCount < 1) throw new Error("empty PDF");
    return { pageCount };
  } catch {
    throw new HttpError(400, "PDF 无法读取，可能已损坏或设置了密码", "INVALID_PDF");
  }
}

export async function addPhoneWatermark(source: ArrayBuffer, phone: string, requestUrl: string): Promise<Uint8Array> {
  return addPhoneWatermarkWithFont(source, phone, await getWatermarkFont(requestUrl));
}

export async function addPhoneWatermarkWithFont(source: ArrayBuffer, phone: string, fontBytes: ArrayBuffer): Promise<Uint8Array> {
  const document = await PDFDocument.load(source, { ignoreEncryption: false, updateMetadata: false });
  document.registerFontkit(fontkit);
  const font = await document.embedFont(fontBytes, { subset: true });

  for (const page of document.getPages()) {
    const { width, height } = page.getSize();
    const fontSize = Math.max(34, Math.min(66, Math.min(width, height) * 0.085));
    const opacity = 0.035;
    page.drawText("祝考试好运 UPUP", {
      x: width * 0.13,
      y: height * 0.35,
      size: fontSize,
      font,
      color: rgb(0.08, 0.08, 0.08),
      opacity,
      rotate: degrees(45),
    });
    page.drawText(phone, {
      x: width * 0.22,
      y: height * 0.17,
      size: fontSize,
      font,
      color: rgb(0.08, 0.08, 0.08),
      opacity,
      rotate: degrees(45),
    });
  }

  return document.save({ useObjectStreams: true });
}

export async function buildBundle(files: Record<MaterialType, Uint8Array>): Promise<Uint8Array> {
  const archive: Record<string, Uint8Array> = {};
  for (const type of MATERIAL_TYPES) archive[DOWNLOAD_NAMES[type]] = files[type];
  return zipSync(archive, { level: 6 });
}

export function outputMimeType(entry: ProductEntry): string {
  return entry === "BUNDLE" ? "application/zip" : "application/pdf";
}
