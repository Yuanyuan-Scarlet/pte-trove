import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, degrees, rgb } from "pdf-lib";
import { zipSync } from "fflate";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DOWNLOAD_NAMES, MATERIAL_TYPES, type MaterialType, type ProductEntry } from "./constants";
import { HttpError } from "./http";

let fontBytesPromise: Promise<ArrayBuffer> | null = null;
let logoBytesPromise: Promise<ArrayBuffer> | null = null;

const WATERMARK_PAGE_WIDTH = 612;
const WATERMARK_PAGE_HEIGHT = 792;
const WATERMARK_FONT_SIZE = 72;
export const WATERMARK_OPACITY = 0.015;
const WATERMARK_ROTATION = 45;
const WATERMARK_TEXT_OFFSET = 100;

export function watermarkTextFields(phone: string): [string, string] {
  return [`  祝考试好运 UPUP`, `    ${phone}`];
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function getWatermarkFont(): Promise<ArrayBuffer> {
  if (!fontBytesPromise) {
    fontBytesPromise = readFile(path.join(process.cwd(), "public", "fonts", "noto-sans-sc-400.ttf")).then(toArrayBuffer).catch((error: unknown) => {
      fontBytesPromise = null;
      throw error;
    });
  }
  return fontBytesPromise;
}

async function getWatermarkLogo(): Promise<ArrayBuffer> {
  if (!logoBytesPromise) {
    logoBytesPromise = readFile(path.join(process.cwd(), "public", "watermark", "logo.jpg")).then(toArrayBuffer).catch((error: unknown) => {
      logoBytesPromise = null;
      throw error;
    });
  }
  return logoBytesPromise;
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

export async function addPhoneWatermark(source: ArrayBuffer, phone: string): Promise<Uint8Array> {
  const [fontBytes, logoBytes] = await Promise.all([getWatermarkFont(), getWatermarkLogo()]);
  return addPhoneWatermarkWithAssets(source, phone, fontBytes, logoBytes);
}

async function createWatermarkPage(phone: string, fontBytes: ArrayBuffer, logoBytes: ArrayBuffer): Promise<Uint8Array> {
  const watermarkDocument = await PDFDocument.create();
  watermarkDocument.registerFontkit(fontkit);
  const [font, logo] = await Promise.all([
    watermarkDocument.embedFont(fontBytes, { subset: false }),
    watermarkDocument.embedJpg(logoBytes),
  ]);
  const page = watermarkDocument.addPage([WATERMARK_PAGE_WIDTH, WATERMARK_PAGE_HEIGHT]);

  page.drawImage(logo, {
    x: WATERMARK_PAGE_WIDTH - logo.width / 6,
    y: 0,
    width: logo.width / 12,
    height: logo.height / 12,
    opacity: WATERMARK_OPACITY,
  });

  const radians = WATERMARK_ROTATION * Math.PI / 180;
  const drawWatermarkText = (text: string, translateX: number, translateY: number) => {
    page.drawText(text, {
      x: translateX - WATERMARK_TEXT_OFFSET * Math.cos(radians),
      y: translateY - WATERMARK_TEXT_OFFSET * Math.sin(radians),
      size: WATERMARK_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      opacity: WATERMARK_OPACITY,
      rotate: degrees(WATERMARK_ROTATION),
    });
  };
  const [greeting, phoneText] = watermarkTextFields(phone);
  drawWatermarkText(greeting, 150, 200);
  drawWatermarkText(phoneText, 200, 90);

  page.drawImage(logo, {
    x: (WATERMARK_PAGE_WIDTH - logo.width) / 2,
    y: (WATERMARK_PAGE_HEIGHT - logo.height) / 2,
    width: logo.width,
    height: logo.height,
    opacity: WATERMARK_OPACITY,
  });

  return watermarkDocument.save({ useObjectStreams: true });
}

export async function addPhoneWatermarkWithAssets(
  source: ArrayBuffer,
  phone: string,
  fontBytes: ArrayBuffer,
  logoBytes: ArrayBuffer,
): Promise<Uint8Array> {
  const document = await PDFDocument.load(source, { ignoreEncryption: false, updateMetadata: false });
  const [watermarkPage] = await document.embedPdf(await createWatermarkPage(phone, fontBytes, logoBytes), [0]);

  for (const page of document.getPages()) {
    const { width, height } = page.getSize();
    page.drawPage(watermarkPage, { x: 0, y: 0, width, height });
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
