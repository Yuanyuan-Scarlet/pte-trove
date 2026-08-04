#!/usr/bin/env node

import {
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  closeBrowser,
  connectCdp,
  createPage,
  launchBrowser,
  resolveBrowserPath,
  waitForDocument,
} from "./generate-marketing-images.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const outputDirectory = resolve(repositoryRoot, "marketing", "square-material-cards");
const dataPath = join(outputDirectory, "cards.json");
const previewPath = join(outputDirectory, "index.html");

export const WIDTH = 1080;
export const HEIGHT = 1080;
export const CARD_TYPES = ["cover", "facts", "structure", "preview", "sprint"];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderTags(tags) {
  return tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
}

function renderHeader(product, index, label) {
  return `<header class="card-header">
    <div class="brand"><img src="../detail-pages/logo.png" alt="小圆 PTE 突击"><strong>小圆 PTE 突击</strong></div>
    <div class="series"><b>${escapeHtml(product.code)} 专项</b><span>${String(index).padStart(2, "0")} / 05 · ${escapeHtml(label)}</span></div>
  </header>`;
}

function renderFooter(product, index) {
  return `<footer><span>纯 PDF 图文资料</span><span>${escapeHtml(product.code)} 专项资料介绍</span><b>${String(index).padStart(2, "0")}</b></footer>`;
}

function renderCover(product) {
  return `<article class="promo-card cover-card" id="card-${product.slug}-cover" style="--accent:${product.accent};--accent-soft:${product.accentSoft}">
    <div class="orb orb-one"></div><div class="orb orb-two"></div><div class="grid-texture"></div>
    ${renderHeader(product, 1, "资料封面")}
    <div class="cover-content">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(product.name)} · ${escapeHtml(product.nameZh)}</p>
        <h1>${escapeHtml(product.title)}</h1>
        <p class="lead">${escapeHtml(product.hook)}</p>
      </div>
      <div class="cover-lower">
        <div class="product-frame"><div class="halo"></div><img src="../product-images/${product.slug}-main.png" alt="${product.code} 商品主图"></div>
        <div class="tag-list">${renderTags(product.tags.slice(0, 4))}</div>
      </div>
    </div>
    ${renderFooter(product, 1)}
  </article>`;
}

function renderFacts(product) {
  const facts = product.facts.map((fact) => `<article class="fact">
    <strong>${escapeHtml(fact.value)}</strong><h3>${escapeHtml(fact.label)}</h3><p>${escapeHtml(fact.copy)}</p>
  </article>`).join("");
  return `<article class="promo-card facts-card" id="card-${product.slug}-facts" style="--accent:${product.accent};--accent-soft:${product.accentSoft}">
    <div class="orb orb-one"></div><div class="orb orb-three"></div>
    ${renderHeader(product, 2, "题型速览")}
    <div class="card-content">
      <p class="eyebrow">先看清这道题</p>
      <h2>${escapeHtml(product.nameZh)}，考场动作先理顺</h2>
      <p class="section-lead">题型规则、作答节奏和训练重点，一张图快速看懂。</p>
      <div class="fact-grid">${facts}</div>
      <div class="takeaway"><span>备考抓手</span><strong>${escapeHtml(product.structureSubtitle)}</strong></div>
    </div>
    ${renderFooter(product, 2)}
  </article>`;
}

function renderStructure(product) {
  const items = product.structure.map((item, index) => `<article class="structure-item">
    <span>${escapeHtml(item.marker)}</span><div><small>0${index + 1}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.copy)}</p></div>
  </article>`).join("");
  return `<article class="promo-card structure-card" id="card-${product.slug}-structure" style="--accent:${product.accent};--accent-soft:${product.accentSoft}">
    <div class="orb orb-two"></div>
    ${renderHeader(product, 3, "资料结构")}
    <div class="card-content">
      <p class="eyebrow">资料里有什么</p>
      <h2>${escapeHtml(product.structureTitle)}</h2>
      <p class="section-lead">${escapeHtml(product.structureSubtitle)}</p>
      <div class="structure-grid">${items}</div>
    </div>
    ${renderFooter(product, 3)}
  </article>`;
}

function renderPreview(product) {
  const imageClass = product.previewImages.length > 1 ? "preview-images is-pair" : "preview-images";
  const images = product.previewImages.map((image, index) => `<figure><img src="../detail-pages/screenshots/${escapeHtml(image)}" alt="${product.code} 资料真实截图 ${index + 1}"></figure>`).join("");
  return `<article class="promo-card preview-card" id="card-${product.slug}-preview" style="--accent:${product.accent};--accent-soft:${product.accentSoft}">
    <div class="orb orb-one"></div>
    ${renderHeader(product, 4, "真实内页")}
    <div class="card-content preview-content">
      <div class="preview-copy"><p class="eyebrow">REAL MATERIAL PREVIEW</p><h2>${escapeHtml(product.previewTitle)}</h2><p class="section-lead">${escapeHtml(product.previewCopy)}</p></div>
      <div class="${imageClass}">${images}</div>
      <div class="preview-note"><b>真实截图</b><span>所见即资料排版 · 图片内容来自现有详情页</span></div>
    </div>
    ${renderFooter(product, 4)}
  </article>`;
}

function renderSprint(product) {
  const steps = product.steps.map((step, index) => `<article class="step">
    <div class="step-number">${index + 1}</div><div><span>${escapeHtml(step.label)}</span><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.copy)}</p></div>
  </article>`).join("");
  return `<article class="promo-card sprint-card" id="card-${product.slug}-sprint" style="--accent:${product.accent};--accent-soft:${product.accentSoft}">
    <div class="orb orb-two"></div><div class="orb orb-three"></div>
    ${renderHeader(product, 5, "练习路径")}
    <div class="card-content">
      <p class="eyebrow">建议这样冲</p>
      <h2>${escapeHtml(product.cta)}</h2>
      <div class="steps">${steps}</div>
      <div class="closing"><strong>觉得有用就拿下</strong><span>早一天开始，多一分把握</span></div>
    </div>
    ${renderFooter(product, 5)}
  </article>`;
}

function renderProductCards(product) {
  return [
    renderCover(product),
    renderFacts(product),
    renderStructure(product),
    renderPreview(product),
    renderSprint(product),
  ].join("\n");
}

export function buildPreview(data, selectedSlugs) {
  const selected = new Set(selectedSlugs || data.products.map((product) => product.slug));
  const cards = data.products.filter((product) => selected.has(product.slug)).map(renderProductCards).join("\n");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PTE 五项资料 1:1 营销图</title>
  <style>
    @font-face{font-family:"Noto Sans SC";src:url("../../public/fonts/noto-sans-sc-400.woff2") format("woff2");font-style:normal;font-weight:400 900;font-display:swap}
    *{box-sizing:border-box}
    html,body{margin:0;background:#E9E2DD;color:#271F2A;font-family:"Noto Sans SC","Microsoft YaHei",Arial,sans-serif}
    body{padding:48px;display:flex;flex-direction:column;align-items:flex-start;gap:48px}
    .promo-card{position:relative;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:linear-gradient(145deg,#FFFEFC 0%,#FFF9F4 66%,var(--accent-soft) 145%);isolation:isolate;box-shadow:0 24px 70px rgba(57,38,47,.15)}
    .promo-card::before{content:"";position:absolute;inset:0 0 auto;height:12px;background:linear-gradient(90deg,var(--accent),#EF4F5C,#FFC75F);z-index:5}
    .orb{position:absolute;border-radius:999px;z-index:-2;pointer-events:none}
    .orb-one{width:380px;height:380px;right:-145px;top:-160px;background:var(--accent-soft);opacity:.85}
    .orb-two{width:310px;height:310px;left:-145px;bottom:-145px;background:#FFE8D4;opacity:.68}
    .orb-three{width:180px;height:180px;right:55px;bottom:92px;background:var(--accent-soft);opacity:.72}
    .grid-texture{position:absolute;inset:0;z-index:-1;opacity:.28;background-image:radial-gradient(color-mix(in srgb,var(--accent) 48%,#9D8A80) 1px,transparent 1px);background-size:24px 24px;mask-image:linear-gradient(black,transparent 78%)}
    .card-header{height:120px;padding:24px 50px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(96,72,82,.14)}
    .brand{display:flex;align-items:center;gap:16px}.brand img{width:68px;height:68px;border-radius:50%;box-shadow:0 8px 20px rgba(83,48,62,.15)}
    .brand strong{font-size:35px;line-height:1.15;letter-spacing:.01em}.series{display:flex;flex-direction:column;align-items:flex-end;gap:6px}.series b{padding:9px 16px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:27px}.series span{color:#766B76;font-family:Arial,"Noto Sans SC",sans-serif;font-size:22px;font-weight:700;letter-spacing:.035em}
    .card-content{height:884px;padding:40px 50px 22px;display:flex;flex-direction:column}.eyebrow{margin:0;color:var(--accent);font-family:Arial,"Noto Sans SC",sans-serif;font-size:32px;font-weight:900;letter-spacing:.045em;text-transform:uppercase}
    h1,h2,h3,p{overflow-wrap:anywhere}h1{margin:10px 0 0;font-size:68px;line-height:1.05;letter-spacing:-.055em}h2{margin:10px 0 0;font-size:58px;line-height:1.08;letter-spacing:-.045em}
    .lead{margin:15px 0 0;color:#584E5A;font-size:36px;line-height:1.38;font-weight:650}.section-lead{margin:12px 0 0;color:#645965;font-size:34px;line-height:1.36;font-weight:600}
    footer{position:absolute;inset:auto 0 0;height:76px;padding:0 50px;display:flex;align-items:center;gap:20px;border-top:1px solid rgba(96,72,82,.14);background:rgba(255,253,250,.82);color:#665B66;font-size:22px;font-weight:700;letter-spacing:.02em}
    footer span:nth-child(2){margin-left:auto;font-size:24px;font-weight:800;letter-spacing:.02em}footer b{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;background:var(--accent);color:white;font-family:Arial,sans-serif;font-size:22px}
    .cover-content{height:884px;padding:34px 50px 20px;display:flex;flex-direction:column}.cover-card h1{max-width:940px;color:#2E2530}.cover-card .hero-copy{flex:none}.cover-lower{margin-top:22px;display:grid;grid-template-columns:1.08fr .92fr;gap:28px;align-items:center}.tag-list{display:grid;gap:12px}.tag-list span{min-height:68px;padding:12px 18px;display:flex;align-items:center;border:2px solid color-mix(in srgb,var(--accent) 26%,white);border-radius:18px;background:rgba(255,255,255,.9);color:color-mix(in srgb,var(--accent) 82%,#2E2530);font-size:32px;font-weight:900;box-shadow:0 10px 24px rgba(64,42,52,.06)}
    .product-frame{position:relative}.product-frame .halo{position:absolute;inset:7%;border-radius:50%;background:color-mix(in srgb,var(--accent) 19%,#FFE2B7);filter:blur(36px)}.product-frame img{position:relative;width:100%;border:1px solid rgba(255,255,255,.88);border-radius:30px;box-shadow:0 24px 50px rgba(62,39,49,.18);transform:rotate(.6deg)}
    .fact-grid{margin-top:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.fact{min-height:420px;padding:30px 24px;border:2px solid color-mix(in srgb,var(--accent) 20%,#E8DDD7);border-radius:28px;background:rgba(255,255,255,.9);box-shadow:0 16px 38px rgba(67,43,54,.07)}.fact strong{display:block;color:var(--accent);font-size:49px;line-height:1.08}.fact h3{margin:20px 0 12px;font-size:36px;line-height:1.18}.fact p{margin:0;color:#625763;font-size:34px;line-height:1.35;font-weight:600}.takeaway{margin-top:auto;padding:20px 24px;border-radius:22px;background:linear-gradient(100deg,var(--accent),color-mix(in srgb,var(--accent) 72%,#EF4F5C));color:white;display:flex;align-items:center;gap:18px}.takeaway span{flex:none;padding:8px 12px;border-radius:9px;background:rgba(255,255,255,.2);font-size:26px;font-weight:900}.takeaway strong{font-size:33px;line-height:1.25}
    .structure-grid{margin-top:22px;display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.structure-item{min-height:275px;padding:23px;display:grid;grid-template-columns:66px 1fr;gap:17px;border:2px solid color-mix(in srgb,var(--accent) 20%,#E9DDD7);border-radius:27px;background:rgba(255,255,255,.92);box-shadow:0 14px 34px rgba(66,43,54,.065)}.structure-item>span{width:66px;height:66px;display:grid;place-items:center;border-radius:19px;background:var(--accent);color:white;font-size:32px;font-weight:900}.structure-item small{color:var(--accent);font-family:Arial,sans-serif;font-size:21px;font-weight:900;letter-spacing:.07em}.structure-item h3{margin:5px 0 8px;font-size:34px;line-height:1.16}.structure-item p{margin:0;color:#5F5560;font-size:33px;line-height:1.3;font-weight:600}
    .preview-content{padding-top:28px}.preview-copy{min-height:196px;display:grid;grid-template-columns:.88fr 1.35fr;column-gap:26px;align-items:start}.preview-copy .eyebrow{grid-column:1/-1}.preview-copy h2{font-size:54px}.preview-copy .section-lead{margin-top:7px;font-size:34px}.preview-images{margin-top:10px;height:514px;display:grid;grid-template-columns:1fr;gap:16px}.preview-images.is-pair{grid-template-columns:repeat(2,1fr)}.preview-images figure{margin:0;overflow:hidden;border:10px solid white;border-radius:24px;background:#F2ECE7;box-shadow:0 20px 46px rgba(56,38,48,.15)}.preview-images img{width:100%;height:100%;object-fit:cover;object-position:top}.preview-note{margin-top:12px;display:flex;align-items:center;justify-content:center;gap:12px;color:#5F555F;font-size:32px;font-weight:700}.preview-note b{padding:8px 12px;border-radius:9px;background:var(--accent);color:#fff;font-size:28px}
    .sprint-card h2{max-width:940px}.steps{margin-top:20px;display:grid;gap:12px}.step{min-height:166px;padding:18px 24px;display:grid;grid-template-columns:66px 1fr;gap:19px;align-items:start;border:2px solid color-mix(in srgb,var(--accent) 20%,#E8DDD7);border-radius:24px;background:rgba(255,255,255,.92)}.step-number{width:66px;height:66px;display:grid;place-items:center;border-radius:18px;background:var(--accent);color:#fff;font-family:Arial,sans-serif;font-size:31px;font-weight:900}.step span{color:var(--accent);font-size:27px;font-weight:900;letter-spacing:.01em}.step h3{margin:2px 0 4px;font-size:35px;line-height:1.16}.step p{margin:0;color:#5F555F;font-size:33px;line-height:1.28;font-weight:600}.closing{margin-top:auto;padding:19px 25px;border-radius:22px;background:linear-gradient(100deg,var(--accent),color-mix(in srgb,var(--accent) 70%,#EF4F5C));color:white;display:flex;align-items:center;justify-content:space-between}.closing strong{font-size:33px}.closing span{font-size:29px;font-weight:800}
  </style>
</head>
<body>
${cards}
</body>
</html>\n`;
}

export function parseCliArgs(argv, products) {
  const options = {
    browserPath: process.env.PTE_SCREENSHOT_BROWSER || "",
    only: products.map((product) => product.slug),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--help" || argument === "-h") return { ...options, help: true };
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}.`);
    if (argument === "--browser") options.browserPath = value;
    else if (argument === "--only") {
      const selected = [...new Set(value.split(",").map((item) => item.trim().toLowerCase()))];
      const known = new Set(products.map((product) => product.slug));
      const invalid = selected.filter((slug) => !known.has(slug));
      if (selected.length === 0 || invalid.length > 0) throw new Error(`--only accepts: ${[...known].join(", ")}.`);
      options.only = selected;
    } else throw new Error(`Unknown option: ${argument}`);
    index += 1;
  }
  return options;
}

function printHelp(products) {
  console.log(`Generate five 1080 x 1080 marketing cards for each PTE material.\n\nUsage:\n  npm run marketing:square-cards\n  npm run marketing:square-cards -- --only wfd,di\n\nOptions:\n  --only <list>      Comma-separated products: ${products.map((product) => product.slug).join(", ")}\n  --browser <path>   Chrome or Edge executable\n  --help             Show this help`);
}

function cleanPreviousCards(slug) {
  const pattern = new RegExp(`^${slug}-\\d{2}-(?:${CARD_TYPES.join("|")})\\.png$`);
  for (const entry of readdirSync(outputDirectory, { withFileTypes: true })) {
    if (entry.isFile() && pattern.test(entry.name)) unlinkSync(join(outputDirectory, entry.name));
  }
}

async function preparePage(cdp) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await Promise.all(Array.from(document.images, (image) => image.decode?.().catch(() => undefined)));
      await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
      return {
        cardCount: document.querySelectorAll(".promo-card").length,
        failedImages: Array.from(document.images).filter((image) => image.naturalWidth === 0).map((image) => image.src),
        overflowElements: Array.from(document.querySelectorAll(".hero-copy, .fact, .structure-item, .preview-copy, .step"))
          .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
          .map((element) => ({
            card: element.closest(".promo-card")?.id,
            className: element.className,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight
          }))
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.result.value;
}

function filenameFor(product, type, index) {
  return `${product.slug}-${String(index + 1).padStart(2, "0")}-${type}.png`;
}

async function renderCards(data, options) {
  const selectedProducts = data.products.filter((product) => options.only.includes(product.slug));
  const browserPath = resolveBrowserPath(options.browserPath);
  const browser = await launchBrowser(browserPath);
  let pageCdp;
  try {
    const page = await createPage(browser.port);
    pageCdp = await connectCdp(page.webSocketDebuggerUrl);
    await pageCdp.send("Page.enable");
    await pageCdp.send("Runtime.enable");
    await pageCdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: HEIGHT,
      mobile: false,
      screenHeight: HEIGHT,
      screenWidth: WIDTH,
      width: WIDTH,
    });
    await pageCdp.send("Emulation.setScrollbarsHidden", { hidden: true });
    await pageCdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    const previewUrl = pathToFileURL(previewPath).href;
    await pageCdp.send("Page.navigate", { url: previewUrl });
    await waitForDocument(pageCdp, previewUrl);
    const pageInfo = await preparePage(pageCdp);
    const expectedCount = selectedProducts.length * CARD_TYPES.length;
    if (pageInfo.cardCount !== expectedCount) throw new Error(`Expected ${expectedCount} cards, found ${pageInfo.cardCount}.`);
    if (pageInfo.failedImages.length > 0) throw new Error(`Preview contains failed images:\n${pageInfo.failedImages.join("\n")}`);
    if (pageInfo.overflowElements.length > 0) throw new Error(`Card content overflows:\n${JSON.stringify(pageInfo.overflowElements, null, 2)}`);
    await pageCdp.send("Runtime.evaluate", {
      expression: `window.__promoCardHtml=Object.fromEntries(Array.from(document.querySelectorAll(".promo-card"),(card)=>[card.id,card.outerHTML]))`,
    });

    for (const product of selectedProducts) {
      cleanPreviousCards(product.slug);
      for (let index = 0; index < CARD_TYPES.length; index += 1) {
        const type = CARD_TYPES[index];
        const id = `card-${product.slug}-${type}`;
        const rectResult = await pageCdp.send("Runtime.evaluate", {
          expression: `(async () => {
            const cardHtml=window.__promoCardHtml?.[${JSON.stringify(id)}];
            if(!cardHtml)return null;
            document.body.innerHTML=cardHtml;
            document.body.style.padding="0";
            document.body.style.gap="0";
            document.body.style.overflow="hidden";
            const card=document.getElementById(${JSON.stringify(id)});
            card.style.position="fixed";
            card.style.inset="0";
            await Promise.all(Array.from(card.querySelectorAll("img"),(image)=>image.decode?.().catch(()=>undefined)));
            await new Promise((resolveFrame)=>requestAnimationFrame(()=>requestAnimationFrame(resolveFrame)));
            await new Promise((resolveWait)=>setTimeout(resolveWait,120));
            const rect=card.getBoundingClientRect();
            return {x:rect.x,y:rect.y,width:rect.width,height:rect.height};
          })()`,
          awaitPromise: true,
          returnByValue: true,
        });
        const rect = rectResult.result.value;
        if (!rect || rect.x !== 0 || rect.y !== 0 || rect.width !== WIDTH || rect.height !== HEIGHT) throw new Error(`Unexpected geometry for ${id}: ${JSON.stringify(rect)}`);
        const screenshot = await pageCdp.send("Page.captureScreenshot", {
          captureBeyondViewport: false,
          format: "png",
          fromSurface: true,
        });
        const filename = filenameFor(product, type, index);
        writeFileSync(join(outputDirectory, filename), Buffer.from(screenshot.data, "base64"));
        console.log(`Generated ${filename}`);
      }
    }
  } finally {
    pageCdp?.close();
    await closeBrowser(browser);
  }
  return selectedProducts.length * CARD_TYPES.length;
}

async function main() {
  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  const options = parseCliArgs(process.argv.slice(2), data.products);
  if (options.help) return printHelp(data.products);
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(previewPath, buildPreview(data, options.only));
  const count = await renderCards(data, options);
  console.log(`Generated ${count} square PTE material cards in ${outputDirectory}.`);
}

const invokedScript = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedScript === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
