import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  buildSlicePlan,
  parseCliArgs,
  PRODUCTS,
} from "../scripts/generate-marketing-images.mjs";

test("marketing image slices cover the full page without gaps or overlaps", () => {
  const slices = buildSlicePlan(3_201, 1_600);

  assert.deepEqual(slices, [
    { index: 1, y: 0, height: 1_600 },
    { index: 2, y: 1_600, height: 1_600 },
    { index: 3, y: 3_200, height: 1_600 },
  ]);
  for (let index = 1; index < slices.length; index += 1) {
    assert.equal(slices[index].y, slices[index - 1].y + slices[index - 1].height);
  }
});

test("marketing image generator defaults to all five pages and a marketing directory", () => {
  const options = parseCliArgs([]);
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));

  assert.deepEqual(options.only, PRODUCTS);
  assert.equal(options.width, 900);
  assert.equal(options.height, 1_600);
  assert.match(options.outputDirectory, /marketing[\\/]detail-page-images$/);
  assert.equal(
    packageJson.scripts["marketing:images"],
    "node scripts/generate-marketing-images.mjs",
  );
});

test("marketing image generator accepts explicit image dimensions and products", () => {
  const options = parseCliArgs([
    "--width",
    "1080",
    "--height",
    "1920",
    "--scale",
    "2",
    "--only",
    "wfd,di",
  ]);

  assert.equal(options.width, 1_080);
  assert.equal(options.height, 1_920);
  assert.equal(options.scale, 2);
  assert.deepEqual(options.only, ["wfd", "di"]);
});
