import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { unzipSync } from "fflate";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, StandardFonts } from "pdf-lib";
import {
  WATERMARK_OPACITY,
  addPhoneWatermarkWithAssets,
  buildBundle,
  watermarkTextFields,
} from "../lib/pdf";

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

let watermarkedPromise: Promise<Uint8Array> | null = null;

function watermarkedSample(): Promise<Uint8Array> {
  if (!watermarkedPromise) {
    watermarkedPromise = (async () => {
      const source = await samplePdf();
      const [fontBuffer, logoBuffer] = await Promise.all([
        readFile(new URL("../public/fonts/noto-sans-sc-400.ttf", import.meta.url)),
        readFile(new URL("../public/watermark/logo.jpg", import.meta.url)),
      ]);
      const fontBytes = fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength) as ArrayBuffer;
      const logoBytes = logoBuffer.buffer.slice(logoBuffer.byteOffset, logoBuffer.byteOffset + logoBuffer.byteLength) as ArrayBuffer;
      return addPhoneWatermarkWithAssets(source, "13800000000", fontBytes, logoBytes);
    })();
  }
  return watermarkedPromise;
}

test("adds text and logo watermark resources to every PDF page without changing page count", async () => {
  const result = await watermarkedSample();
  const output = await PDFDocument.load(result);
  assert.equal(output.getPageCount(), 2);
  assert.ok(result.byteLength > 1_000_000, "the complete CJK font must remain embedded so every glyph renders");

  const objectSubtypes = [...output.context.enumerateIndirectObjects()]
    .map(([, object]) => {
      const dictionary = object instanceof PDFDict ? object : object instanceof PDFRawStream ? object.dict : undefined;
      return dictionary?.get(PDFName.of("Subtype"))?.toString();
    });
  assert.ok(objectSubtypes.includes("/Form"), "the PDF must contain the watermark form");
  assert.ok(objectSubtypes.includes("/Image"), "the PDF must contain the logo image");
});

test("wraps each page and its watermark into a page-specific nested form", async () => {
  const output = await PDFDocument.load(await watermarkedSample());
  const wrapperRefs = new Set<string>();
  for (const page of output.getPages()) {
    const resources = page.node.Resources();
    assert.ok(resources, "every page must have a resource dictionary");
    const xObjects = resources.lookup(PDFName.of("XObject"), PDFDict);
    const keys = xObjects.keys();
    assert.equal(keys.length, 1, "each page must draw exactly one wrapper form");
    wrapperRefs.add(String(xObjects.get(keys[0])));

    const wrapper = output.context.lookup(xObjects.get(keys[0]), PDFRawStream);
    assert.equal(wrapper.dict.get(PDFName.of("Subtype"))?.toString(), "/Form");
    const wrapperResources = output.context.lookup(wrapper.dict.get(PDFName.of("Resources")), PDFDict);
    const nested = output.context.lookup(wrapperResources.get(PDFName.of("XObject")), PDFDict);
    const nestedSubtypes = nested.keys().map((key) => {
      const stream = output.context.lookup(nested.get(key), PDFRawStream);
      return stream.dict.get(PDFName.of("Subtype"))?.toString();
    });
    assert.ok(nestedSubtypes.includes("/Form"), "the watermark form must nest inside the wrapper instead of sitting on the page");
  }
  assert.equal(wrapperRefs.size, output.getPageCount(), "pages must not share one strippable watermark object");
});

test("draws the corner logo opaque and keeps text and center logo at the delivery opacity", async () => {
  const output = await PDFDocument.load(await watermarkedSample());
  const page = output.getPages()[0];
  const xObjects = page.node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);
  const wrapper = output.context.lookup(xObjects.get(xObjects.keys()[0]), PDFRawStream);
  const wrapperResources = output.context.lookup(wrapper.dict.get(PDFName.of("Resources")), PDFDict);
  const nested = output.context.lookup(wrapperResources.get(PDFName.of("XObject")), PDFDict);
  const watermarkForm = output.context.lookup(nested.get(nested.keys()[0]), PDFRawStream);
  const watermarkResources = output.context.lookup(watermarkForm.dict.get(PDFName.of("Resources")), PDFDict);

  const images = output.context.lookup(watermarkResources.get(PDFName.of("XObject")), PDFDict);
  assert.equal(images.keys().length, 2, "the watermark form must draw both the corner logo and the center logo");

  const graphicsStates = output.context.lookup(watermarkResources.get(PDFName.of("ExtGState")), PDFDict);
  const alphas = graphicsStates.keys().map((key) => {
    const state = output.context.lookup(graphicsStates.get(key), PDFDict);
    return state.get(PDFName.of("ca"))?.toString();
  });
  assert.deepEqual(
    alphas,
    ["0.015", "0.015", "0.015"],
    "exactly the two text lines and the center logo carry transparency; the corner logo draws opaque",
  );
});

test("uses the delivery watermark opacity and leading text spacing", () => {
  assert.equal(WATERMARK_OPACITY, 0.015);
  assert.deepEqual(watermarkTextFields("13800000000"), [
    "  祝考试好运 UPUP",
    "    13800000000",
  ]);
});

test("weaves the manual salutation into the greeting without touching the phone line", () => {
  assert.deepEqual(watermarkTextFields("+61 412 345 678", "张同学"), [
    "  祝张同学考试好运 UPUP",
    "    +61 412 345 678",
  ]);
  assert.deepEqual(watermarkTextFields("13800000000", ""), [
    "  祝考试好运 UPUP",
    "    13800000000",
  ]);
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
