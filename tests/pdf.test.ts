import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { unzipSync } from "fflate";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, StandardFonts } from "pdf-lib";
import { addPhoneWatermarkWithAssets, buildBundle } from "../lib/pdf";

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

test("adds text and logo watermark resources to every PDF page without changing page count", async () => {
  const source = await samplePdf();
  const [fontBuffer, logoBuffer] = await Promise.all([
    readFile(new URL("../public/fonts/noto-sans-sc-400.ttf", import.meta.url)),
    readFile(new URL("../public/watermark/logo.jpg", import.meta.url)),
  ]);
  const fontBytes = fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength) as ArrayBuffer;
  const logoBytes = logoBuffer.buffer.slice(logoBuffer.byteOffset, logoBuffer.byteOffset + logoBuffer.byteLength) as ArrayBuffer;
  const result = await addPhoneWatermarkWithAssets(source, "13800000000", fontBytes, logoBytes);
  const output = await PDFDocument.load(result);
  assert.equal(output.getPageCount(), 2);
  assert.ok(result.byteLength > 1_000_000, "the complete CJK font must remain embedded so every glyph renders");
  for (const page of output.getPages()) {
    const resources = page.node.Resources();
    assert.ok(resources, "every page must have a resource dictionary");
    const xObjects = resources.lookup(PDFName.of("XObject"), PDFDict);
    assert.ok(xObjects.keys().length >= 1, "every page must draw the shared watermark form");
  }

  const objectSubtypes = [...output.context.enumerateIndirectObjects()]
    .map(([, object]) => {
      const dictionary = object instanceof PDFDict ? object : object instanceof PDFRawStream ? object.dict : undefined;
      return dictionary?.get(PDFName.of("Subtype"))?.toString();
    });
  assert.ok(objectSubtypes.includes("/Form"), "the PDF must contain the shared watermark page");
  assert.ok(objectSubtypes.includes("/Image"), "the PDF must contain the logo image");
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
