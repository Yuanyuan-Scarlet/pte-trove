import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  buildPreview,
  CARD_TYPES,
  HEIGHT,
  parseCliArgs,
  WIDTH,
} from "../scripts/generate-square-material-cards.mjs";

const contentRoot = join(process.cwd(), "marketing", "square-material-cards");
const data = JSON.parse(readFileSync(join(contentRoot, "cards.json"), "utf8"));

test("square material cards define five distinct PTE products and five cards each", () => {
  assert.deepEqual(data.products.map((product: { slug: string }) => product.slug), [
    "wfd",
    "di",
    "sst",
    "rs",
    "we",
  ]);
  assert.equal(WIDTH, 1_080);
  assert.equal(HEIGHT, 1_080);
  assert.equal(CARD_TYPES.length, 5);

  for (const product of data.products) {
    assert.equal(product.facts.length, 3);
    assert.equal(product.structure.length, 4);
    assert.equal(product.steps.length, 3);
    assert.ok(product.previewImages.length >= 1);
  }
});

test("square material card preview includes all 25 exact-size cards and real assets", () => {
  const preview = buildPreview(data);
  assert.equal(preview.match(/class="promo-card /g)?.length, 25);
  assert.ok(preview.includes("width:1080px;height:1080px"));

  for (const product of data.products) {
    for (const type of CARD_TYPES) {
      assert.ok(preview.includes(`id="card-${product.slug}-${type}"`));
    }
    assert.ok(preview.includes(`../product-images/${product.slug}-main.png`));
    for (const image of product.previewImages) {
      assert.ok(preview.includes(`../detail-pages/screenshots/${image}`));
    }
  }
});

test("square material cards keep carousel copy legible at phone width", () => {
  const preview = buildPreview(data);
  const fontRules = [
    ["header brand", /\.brand strong\{[^}]*font-size:(\d+)px/],
    ["eyebrow", /\.eyebrow\{[^}]*font-size:(\d+)px/],
    ["lead", /\.lead\{[^}]*font-size:(\d+)px/],
    ["fact copy", /\.fact p\{[^}]*font-size:(\d+)px/],
    ["structure copy", /\.structure-item p\{[^}]*font-size:(\d+)px/],
    ["preview note", /\.preview-note\{[^}]*font-size:(\d+)px/],
    ["step copy", /\.step p\{[^}]*font-size:(\d+)px/],
  ] as const;

  for (const [label, pattern] of fontRules) {
    const match = preview.match(pattern);
    assert.ok(match, `Missing font-size rule for ${label}.`);
    const displayedSize = Number(match[1]) * (375 / WIDTH);
    assert.ok(displayedSize >= 11.1, `${label} scales to only ${displayedSize}px.`);
  }

  assert.ok(preview.includes('class="cover-lower"'));
  assert.ok(preview.includes(".cover-content{height:884px;padding:34px 50px 20px;display:flex;flex-direction:column}"));
});

test("square material card generator accepts a product subset", () => {
  const options = parseCliArgs(["--only", "wfd,di"], data.products);
  assert.deepEqual(options.only, ["wfd", "di"]);
  assert.throws(
    () => parseCliArgs(["--only", "bundle"], data.products),
    /--only accepts/,
  );
});

test("generated square material card artifacts stay out of version control", () => {
  const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
  assert.ok(gitignore.includes("/marketing/square-material-cards/*.png"));
  assert.ok(gitignore.includes("/marketing/square-material-cards/index.html"));
});
