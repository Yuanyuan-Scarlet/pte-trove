import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const products = [
  { slug: "wfd", label: "WFD", color: "#0066ff" },
  { slug: "di", label: "DI", color: "#ff6d01" },
  { slug: "sst", label: "SST", color: "#f5a400" },
  { slug: "rs", label: "RS", color: "#ec5b99" },
  { slug: "we", label: "WE", color: "#8a3ffc" },
] as const;

function detailPath(filename: string) {
  return join(process.cwd(), "marketing", "detail-pages", filename);
}

function productImagePath(filename: string) {
  return join(process.cwd(), "marketing", "product-images", filename);
}

test("marketing detail pages include mobile layout, delivery flow, and rights notice", () => {
  for (const product of products) {
    const html = readFileSync(detailPath(`${product.slug}.html`), "utf8");
    assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/);
    assert.match(html, new RegExp(`>${product.label} 专项<`));
    assert.ok(html.includes(`--accent:${product.color}`));
    assert.ok(html.includes(`../product-images/${product.slug}-main.png`));
    assert.ok(html.includes("中国大陆手机号"));
    assert.ok(html.includes("P 开头加 18 位数字"));
    assert.ok(html.includes("生成后 14 天内"));
    assert.ok(html.includes('class="hero-lead"'));
    assert.ok(html.includes("未经授权不得随意倒卖或分享"));
  }

  const rsHtml = readFileSync(detailPath("rs.html"), "utf8");
  assert.ok(rsHtml.includes("提示音后立即开口"));
});

test("all generated product images are square and large enough for ecommerce use", () => {
  for (const slug of [...products.map((product) => product.slug), "bundle"]) {
    const png = readFileSync(productImagePath(`${slug}-main.png`));
    assert.equal(png.toString("ascii", 1, 4), "PNG");
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    assert.equal(width, height);
    assert.ok(width >= 1024);
  }
});
