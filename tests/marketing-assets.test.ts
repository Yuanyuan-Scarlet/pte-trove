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

function visibleText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replace(/\s+/g, " ")
    .trim();
}

function productDetailText(slug: string) {
  const html = readFileSync(detailPath(`${slug}.html`), "utf8");
  const heroStart = html.indexOf('<section class="hero">');
  const heroEnd = html.indexOf("</section>", heroStart) + "</section>".length;
  const deliveryMarker = html.indexOf("购买后如何领取", heroEnd);
  const deliveryStart = html.lastIndexOf('<section class="section alt">', deliveryMarker);

  assert.ok(heroStart >= 0, `${slug} is missing its hero.`);
  assert.ok(deliveryMarker >= 0, `${slug} is missing its delivery flow.`);
  assert.ok(deliveryStart > heroEnd, `${slug} detail content could not be isolated.`);
  return visibleText(html.slice(heroEnd, deliveryStart));
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

test("bundle detail page preserves all five product sections in the requested order", () => {
  const html = readFileSync(detailPath("bundle.html"), "utf8");
  const text = visibleText(html);
  const requestedOrder = ["di", "wfd", "we", "sst", "rs"];
  let previousPosition = -1;

  assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/);
  assert.ok(html.includes(">五项合集<"));
  assert.ok(html.includes("--accent:#0e7c82"));
  assert.ok(html.includes("../product-images/bundle-main.png"));

  for (const slug of requestedOrder) {
    const productText = productDetailText(slug);
    const position = text.indexOf(productText);
    assert.ok(position > previousPosition, `${slug.toUpperCase()} content is missing or out of order.`);
    previousPosition = position;
  }

  assert.equal(html.match(/购买后如何领取/g)?.length, 1);
  assert.equal(html.match(/填写中国大陆手机号/g)?.length, 1);
  assert.equal(html.match(/未经授权不得随意倒卖或分享/g)?.length, 1);
  assert.ok(html.includes("五项专属 PDF 合集 ZIP"));
});
