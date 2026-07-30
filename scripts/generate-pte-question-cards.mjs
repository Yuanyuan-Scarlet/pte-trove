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
const contentRoot = resolve(repositoryRoot, "marketing", "pte-academic-question-types");
const dataPath = join(contentRoot, "question-types.json");
const previewPath = join(contentRoot, "index.html");
const notesPath = join(contentRoot, "question-types.md");
const outputDirectory = join(contentRoot, "cards");
const WIDTH = 1200;
const HEIGHT = 900;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sectionTheme(section) {
  if (section === "reading") {
    return { accent: "#157F85", pale: "#E8F7F5", soft: "#CFEDEA" };
  }
  if (section === "listening") {
    return { accent: "#B85C31", pale: "#FFF0E5", soft: "#F9D7C3" };
  }
  return { accent: "#6F4CB3", pale: "#F0EAFC", soft: "#DFD2F7" };
}

function renderTags(values) {
  return values.map((value) => `<span>${escapeHtml(value)}</span>`).join("");
}

function renderRules(values) {
  return values
    .map((value, index) => `<li><b>${index + 1}</b><span>${escapeHtml(value)}</span></li>`)
    .join("");
}

function renderCard(item, logoDataUrl, footer) {
  const theme = sectionTheme(item.section);
  return `
    <article
      class="question-card"
      id="card-${escapeHtml(item.id)}"
      data-filename="${escapeHtml(item.filename)}"
      style="--accent:${theme.accent};--pale:${theme.pale};--soft:${theme.soft}"
    >
      <div class="orb orb-one"></div>
      <div class="orb orb-two"></div>
      <header class="card-header">
        <div class="brand">
          <img src="${logoDataUrl}" alt="小圆PTE突击 round logo">
          <div><strong>小圆PTE突击</strong><small>PTE Academic 题型速览</small></div>
        </div>
        <div class="part-pill">${escapeHtml(item.sectionLabel)}</div>
      </header>
      <main class="card-content">
        <section class="overview">
          <div class="eyebrow"><span>${escapeHtml(item.sequence)}</span> QUESTION TYPE</div>
          <h1>${escapeHtml(item.name)}</h1>
          <h2>${escapeHtml(item.nameZh)}</h2>
          <div class="task-block">
            <h3>这题做什么</h3>
            <p>${escapeHtml(item.task)}</p>
          </div>
          <div class="facts">
            <div><small>题干 / 材料</small><strong>${escapeHtml(item.prompt)}</strong></div>
            <div><small>作答时间</small><strong>${escapeHtml(item.answerTime)}</strong></div>
            <div><small>计分技能</small><strong>${escapeHtml(item.skills)}</strong></div>
          </div>
        </section>
        <aside class="scoring">
          <div class="scoring-topline"><span>SCORING</span><b>${escapeHtml(item.scoreType)}</b></div>
          <h3>怎么评分</h3>
          <div class="trait-tags">${renderTags(item.scoreTraits)}</div>
          <p class="scoring-copy">${escapeHtml(item.scoring)}</p>
          <div class="rules-box">
            <h4>作答关键</h4>
            <ol>${renderRules(item.rules)}</ol>
          </div>
        </aside>
      </main>
      <footer>
        <span>${escapeHtml(footer)}</span>
        <span>${escapeHtml(item.sequence)} / ${escapeHtml(item.sectionLabel.replace("Part ", "P"))}</span>
      </footer>
    </article>`;
}

function buildPreview(data) {
  const logoDataUrl = "../detail-pages/logo.png";
  const regularFontDataUrl = "../../node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff2";
  const mediumFontDataUrl = "../../node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-600-normal.woff2";
  const cards = data.questionTypes
    .map((item) => renderCard(item, logoDataUrl, data.footer))
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PTE Academic 全部题型简介图</title>
  <style>
    @font-face{font-family:"Noto Sans SC";src:url("${regularFontDataUrl}") format("woff2");font-style:normal;font-weight:400;font-display:swap}
    @font-face{font-family:"Noto Sans SC";src:url("${mediumFontDataUrl}") format("woff2");font-style:normal;font-weight:600 900;font-display:swap}
    *{box-sizing:border-box}
    html,body{margin:0;background:#DDD7CF;color:#29252D;font-family:"Noto Sans SC","Microsoft YaHei",Arial,sans-serif}
    body{padding:48px;display:flex;flex-direction:column;align-items:flex-start;gap:40px}
    .question-card{position:relative;width:1200px;height:900px;overflow:hidden;background:#FFFCF8;border-radius:0;isolation:isolate}
    .question-card::before{content:"";position:absolute;inset:0 0 auto 0;height:12px;background:var(--accent);z-index:3}
    .orb{position:absolute;border-radius:999px;z-index:-1;pointer-events:none}
    .orb-one{width:360px;height:360px;right:-150px;top:-170px;background:var(--pale)}
    .orb-two{width:260px;height:260px;left:-120px;bottom:-150px;background:var(--pale)}
    .card-header{height:122px;padding:31px 56px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E8E1D9}
    .brand{display:flex;align-items:center;gap:14px}
    .brand img{width:58px;height:58px;object-fit:contain;border-radius:50%;background:#fff;box-shadow:0 4px 16px rgba(37,28,48,.12)}
    .brand div{display:flex;flex-direction:column;gap:1px}
    .brand strong{font-size:21px;line-height:1.3;letter-spacing:.02em}
    .brand small{font-size:13px;color:#817A83;letter-spacing:.08em}
    .part-pill{padding:11px 18px;border-radius:999px;background:var(--pale);color:var(--accent);font-size:16px;font-weight:700;letter-spacing:.03em}
    .card-content{height:706px;padding:44px 56px 32px;display:grid;grid-template-columns:1.07fr .93fr;gap:44px}
    .overview{min-width:0;display:flex;flex-direction:column}
    .eyebrow{display:flex;align-items:center;gap:10px;color:var(--accent);font-size:13px;font-weight:800;letter-spacing:.15em}
    .eyebrow span{display:grid;place-items:center;min-width:38px;height:28px;padding:0 8px;border-radius:8px;background:var(--accent);color:#fff;font-size:13px;letter-spacing:.03em}
    h1{margin:18px 0 0;font-family:Arial,"Noto Sans SC",sans-serif;font-size:49px;line-height:1.08;letter-spacing:-.035em;color:#28232D}
    h2{margin:7px 0 0;color:var(--accent);font-size:27px;line-height:1.3;font-weight:700}
    .task-block{margin-top:32px;padding-left:20px;border-left:5px solid var(--accent)}
    .task-block h3,.scoring h3{margin:0 0 10px;font-size:22px;line-height:1.3}
    .task-block p{margin:0;color:#514B55;font-size:20px;line-height:1.68}
    .facts{margin-top:auto;display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .facts div{min-height:84px;padding:14px 16px;border:1px solid #E6DED5;border-radius:14px;background:rgba(255,255,255,.8);display:flex;flex-direction:column;gap:6px}
    .facts div:first-child{grid-column:1/-1}
    .facts small{color:#8A8288;font-size:13px;font-weight:600;letter-spacing:.06em}
    .facts strong{font-size:16px;line-height:1.45;color:#37313A}
    .scoring{align-self:stretch;padding:30px 30px 26px;border-radius:26px;background:#2E2933;color:#fff;display:flex;flex-direction:column;box-shadow:0 20px 45px rgba(47,40,55,.14)}
    .scoring-topline{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px}
    .scoring-topline>span{font-family:Arial,sans-serif;color:#BDB5C3;font-size:12px;font-weight:700;letter-spacing:.18em}
    .scoring-topline b{padding:7px 12px;border-radius:999px;background:var(--accent);font-size:13px;letter-spacing:.03em}
    .scoring h3{font-size:27px;margin-bottom:16px}
    .trait-tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
    .trait-tags span{padding:7px 11px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(255,255,255,.08);font-size:13px;line-height:1.25}
    .scoring-copy{margin:0;color:#EEE9F1;font-size:17px;line-height:1.7}
    .rules-box{margin-top:auto;padding:19px 20px 17px;border-radius:18px;background:#FFFCF8;color:#352F38}
    .rules-box h4{margin:0 0 13px;color:var(--accent);font-size:16px;letter-spacing:.06em}
    .rules-box ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
    .rules-box li{display:flex;align-items:flex-start;gap:10px;font-size:15px;line-height:1.42}
    .rules-box li b{flex:0 0 23px;height:23px;border-radius:50%;display:grid;place-items:center;background:var(--pale);color:var(--accent);font-size:12px}
    footer{height:72px;padding:0 56px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid #E8E1D9;color:#9A9399;font-size:12px;letter-spacing:.025em}
    footer span:last-child{color:#B0A9AE;font-family:Arial,"Noto Sans SC",sans-serif;letter-spacing:.08em}
  </style>
</head>
<body>
${cards}
</body>
</html>
`;
}

function buildNotes(data) {
  const sections = [
    ["speaking-writing", "Part 1：Speaking & Writing（9 个计分题型 + Personal Introduction）"],
    ["reading", "Part 2：Reading（5 个计分题型）"],
    ["listening", "Part 3：Listening（8 个计分题型）"],
  ];
  const lines = [
    "# PTE Academic 题型整理稿",
    "",
    "> 本文档由 AI 辅助整理，并由项目负责人审核。",
    "",
    `核对日期：${data.checkedOn}。以下内容是依据 Pearson PTE 官网重新组织的中文摘要，用于项目检查和图片生成，不是官网原文副本。考试规则可能更新，发布前应再次核对文末官方链接。`,
    "",
    "## 整理范围",
    "",
    "当前官网列出 22 个计分题型：Speaking & Writing 9 个、Reading 5 个、Listening 8 个。另整理 1 个不计分的 Personal Introduction，因此共生成 23 张图片。",
    "",
  ];

  for (const [section, title] of sections) {
    lines.push(`## ${title}`, "");
    for (const item of data.questionTypes.filter((candidate) => candidate.section === section)) {
      lines.push(
        `### ${item.name}｜${item.nameZh}`,
        "",
        `- 做什么：${item.task}`,
        `- 题干或材料：${item.prompt}`,
        `- 作答时间：${item.answerTime}`,
        `- 计分技能：${item.skills}`,
        `- 评分方式：${item.scoreType}；${item.scoring}`,
        `- 作答关键：${item.rules.join("；")}。`,
        `- 官方来源：${item.source}`,
        "",
      );
    }
  }

  lines.push(
    "## 核对备注",
    "",
    "- Pearson Reading 页面当前在 Multiple Choice, Multiple Answers 的“如何评分”位置重复显示了 Fill in the Blanks (Dropdown) 的段落；本整理采用同一题型测试提示中明确写出的规则：正确选择得分，错误选择会扣分。",
    "- 页面中标注为 Not applicable 的单题作答时间统一写为“未设单题时长”，避免误导为无限时间；考生仍受对应考试部分的总时长限制。",
    "- 图片中的字数、准备时间、录音时间、音频长度和评分项均来自核对日期当天的 Pearson PTE 页面。",
    "",
    "## 官方页面",
    "",
    `- 总览：${data.officialLandingPage}`,
    "- Speaking & Writing：https://www.pearsonpte.com/pte-academic/test-format/speaking-writing/",
    "- Reading：https://www.pearsonpte.com/pte-academic/test-format/reading/",
    "- Listening：https://www.pearsonpte.com/pte-academic/test-format/listening/",
    "",
  );
  return `${lines.join("\n").trimEnd()}\n`;
}

function cleanPreviousCards() {
  for (const entry of readdirSync(outputDirectory, { withFileTypes: true })) {
    if (entry.isFile() && /^p[123]-\d{2}-.+\.png$/.test(entry.name)) {
      unlinkSync(join(outputDirectory, entry.name));
    }
  }
}

async function preparePage(cdp) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await Promise.all(Array.from(document.images, (image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolveImage) => {
          image.addEventListener("load", resolveImage, { once: true });
          image.addEventListener("error", resolveImage, { once: true });
        });
      }));
      await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
      return {
        cardCount: document.querySelectorAll(".question-card").length,
        failedImages: Array.from(document.images).filter((image) => image.naturalWidth === 0).map((image) => image.src),
        overflowElements: Array.from(document.querySelectorAll(".overview, .scoring, .facts, .rules-box"))
          .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
          .map((element) => ({
            card: element.closest(".question-card")?.id,
            className: element.className,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
          })),
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.result.value;
}

async function renderCards(data, browserPath) {
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
      screenWidth: WIDTH + 96,
      width: WIDTH + 96,
    });
    await pageCdp.send("Emulation.setScrollbarsHidden", { hidden: true });
    await pageCdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });

    const previewUrl = pathToFileURL(previewPath).href;
    await pageCdp.send("Page.navigate", { url: previewUrl });
    await waitForDocument(pageCdp, previewUrl);
    const pageInfo = await preparePage(pageCdp);
    if (pageInfo.cardCount !== data.questionTypes.length) {
      throw new Error(`Expected ${data.questionTypes.length} cards, found ${pageInfo.cardCount}.`);
    }
    if (pageInfo.failedImages.length > 0) {
      throw new Error(`Card preview contains failed images:\n${pageInfo.failedImages.join("\n")}`);
    }
    if (pageInfo.overflowElements.length > 0) {
      throw new Error(`Card preview contains overflow:\n${JSON.stringify(pageInfo.overflowElements, null, 2)}`);
    }

    cleanPreviousCards();
    for (const item of data.questionTypes) {
      const rectResult = await pageCdp.send("Runtime.evaluate", {
        expression: `(() => {
          const card = document.getElementById(${JSON.stringify(`card-${item.id}`)});
          if (!card) return null;
          const rect = card.getBoundingClientRect();
          return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
        })()`,
        returnByValue: true,
      });
      const rect = rectResult.result.value;
      if (!rect || rect.width !== WIDTH || rect.height !== HEIGHT) {
        throw new Error(`Unexpected card geometry for ${item.id}: ${JSON.stringify(rect)}`);
      }
      const screenshot = await pageCdp.send("Page.captureScreenshot", {
        captureBeyondViewport: true,
        clip: { ...rect, scale: 1 },
        format: "png",
        fromSurface: true,
      });
      writeFileSync(join(outputDirectory, item.filename), Buffer.from(screenshot.data, "base64"));
      console.log(`Generated ${item.filename}`);
    }
  } finally {
    pageCdp?.close();
    await closeBrowser(browser);
  }
}

async function main() {
  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(previewPath, buildPreview(data));
  writeFileSync(notesPath, buildNotes(data));
  const browserPath = resolveBrowserPath(process.env.PTE_SCREENSHOT_BROWSER || "");
  console.log(`Browser: ${browserPath}`);
  console.log(`Output: ${outputDirectory}`);
  await renderCards(data, browserPath);
  console.log(`Generated ${data.questionTypes.length} PTE question-type cards.`);
}

const invokedScript = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedScript === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export { HEIGHT, WIDTH, buildNotes, buildPreview };
