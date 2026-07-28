import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { unzipSync } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { addPhoneWatermarkWithFont, buildBundle } from "../lib/pdf";

async function samplePdf(): Promise<ArrayBuffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 2; index += 1) {
    const page = document.addPage([595, 842]);
    page.drawText(`Sample page ${index + 1}`, { x: 50, y: 780, font, size: 18 });
  }
  const bytes = await document.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

test("adds the configured watermark to every PDF page without changing page count", async () => {
  const source = await samplePdf();
  const fontBuffer = await readFile(new URL("../public/fonts/noto-sans-sc-400.woff2", import.meta.url));
  const fontBytes = fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength) as ArrayBuffer;
  const result = await addPhoneWatermarkWithFont(source, "13800000000", fontBytes);
  const output = await PDFDocument.load(result);
  assert.equal(output.getPageCount(), 2);
  assert.ok(result.byteLength > source.byteLength);
});

test("builds a five-file bundle with fixed public filenames", async () => {
  const bytes = new Uint8Array(await samplePdf());
  const archive = await buildBundle({ WFD: bytes, DI: bytes, SST: bytes, RS: bytes, WE: bytes });
  const files = unzipSync(archive);
  assert.deepEqual(Object.keys(files).sort(), [
    "PTE突击宝藏资料-DI.pdf",
    "PTE突击宝藏资料-RS.pdf",
    "PTE突击宝藏资料-SST.pdf",
    "PTE突击宝藏资料-WE.pdf",
    "PTE突击宝藏资料-WFD.pdf",
  ].sort());
});
