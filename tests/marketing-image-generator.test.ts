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

test("marketing image generator defaults to all six pages and a marketing directory", () => {
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

test("marketing image body copy remains legible when scaled to a phone width", () => {
  const styles = readFileSync(
    join(process.cwd(), "marketing", "detail-pages", "styles.css"),
    "utf8",
  );
  const bodyCopyRules = [
    ["hero lead", /\.hero-lead\s*\{[^}]*font-size:\s*(\d+)px/],
    ["section subtitle", /\.section-subtitle\s*\{[^}]*font-size:\s*(\d+)px/],
    ["fact copy", /\.fact p[^}]*font-size:\s*(\d+)px/],
    ["sample line", /\.sample-line\s*\{[^}]*font-size:\s*(\d+)px/],
    ["check list", /\.check-list li\s*\{[^}]*font-size:\s*(\d+)px/],
    ["preview copy", /\.preview-heading p\s*\{[^}]*font-size:\s*(\d+)px/],
    ["PDF note", /\.pdf-only\s*\{[^}]*font-size:\s*(\d+)px/],
    ["sprint copy", /\.sprint-row p\s*\{[^}]*font-size:\s*(\d+)px/],
    ["delivery copy", /\.delivery-step p\s*\{[^}]*font-size:\s*(\d+)px/],
    ["delivery note", /\.delivery-note\s*\{[^}]*font-size:\s*(\d+)px/],
    ["CTA copy", /\.cta p\s*\{[^}]*font-size:\s*(\d+)px/],
    ["legal copy", /\.legal\s*\{[^}]*font-size:\s*(\d+)px/],
  ] as const;

  for (const [label, pattern] of bodyCopyRules) {
    const match = styles.match(pattern);
    assert.ok(match, `Missing screenshot font size for ${label}.`);
    const displayedSize = Number(match[1]) * (375 / 900);
    assert.ok(displayedSize >= 11.5, `${label} scales to only ${displayedSize}px.`);
  }
});
