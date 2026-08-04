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
const WIDTH = 900;
const HEIGHT = 1200;

const WEIGHTING_SKILLS = [
  { key: "overall", label: "总分", className: "weight-overall" },
  { key: "listening", label: "听力", className: "weight-listening" },
  { key: "reading", label: "阅读", className: "weight-reading" },
  { key: "speaking", label: "口语", className: "weight-speaking" },
  { key: "writing", label: "写作", className: "weight-writing" },
];

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
    return {
      accent: "#2F9E8F",
      accentStrong: "#176F66",
      pale: "#E8F8F3",
      panel: "#DFF4EE",
      secondary: "#F3A56B",
      soft: "#C5EADF",
    };
  }
  if (section === "listening") {
    return {
      accent: "#EB8268",
      accentStrong: "#A94F43",
      pale: "#FFF0EB",
      panel: "#FFE8E1",
      secondary: "#6E90DE",
      soft: "#FFD1C5",
    };
  }
  return {
    accent: "#8A66C9",
    accentStrong: "#5E3E9B",
    pale: "#F3EDFD",
    panel: "#ECE2FA",
    secondary: "#EE82AA",
    soft: "#DDD0F4",
  };
}

function renderTags(values) {
  return values.map((value) => `<span>${escapeHtml(value)}</span>`).join("");
}

function renderRules(values) {
  return values
    .map((value, index) => `<li><b>${index + 1}</b><span>${escapeHtml(value)}</span></li>`)
    .join("");
}

function renderWeighting(weighting) {
  const cells = WEIGHTING_SKILLS.map(({ key, label, className }) => {
    const value = weighting?.[key] ?? "—";
    const inactiveClass = value === "—" ? " is-empty" : "";
    return `<div class="weight-cell ${className}${inactiveClass}"><small>${label}</small><strong>${escapeHtml(value)}</strong></div>`;
  }).join("");
  const note = weighting
    ? "五项分数分别独立计算；权重为平均测试中的指示性占比，不可直接换算为 10–90 分。"
    : "Personal Introduction 不计分，因此未列入官方 PTE Academic question weighting table。";
  return `<div class="weighting">
            <div class="weighting-heading">
              <div><span>OFFICIAL WEIGHTING</span><h4>PTE 官方平均题型权重</h4></div>
              <small>平均测试 · 指示性占比</small>
            </div>
            <div class="weighting-grid">${cells}</div>
            <p class="weighting-note">${escapeHtml(note)}</p>
          </div>`;
}

function renderCard(item, logoDataUrl, footer, weighting) {
  const theme = sectionTheme(item.section);
  return `
    <article
      class="question-card"
      id="card-${escapeHtml(item.id)}"
      data-filename="${escapeHtml(item.filename)}"
      style="--accent:${theme.accent};--accent-strong:${theme.accentStrong};--pale:${theme.pale};--panel:${theme.panel};--secondary:${theme.secondary};--soft:${theme.soft}"
    >
      <div class="orb orb-one"></div>
      <div class="orb orb-two"></div>
      <div class="orb orb-three"></div>
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
          <div class="scoring-body">
            <div class="scoring-detail">
              <h3>怎么评分</h3>
              <div class="trait-tags">${renderTags(item.scoreTraits)}</div>
              <p class="scoring-copy">${escapeHtml(item.scoring)}</p>
            </div>
            <div class="rules-box">
              <h4>作答关键</h4>
              <ol>${renderRules(item.rules)}</ol>
            </div>
          </div>
          ${renderWeighting(weighting)}
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
  const weightingById = new Map(data.weightingTable.map((row) => [row.id, row]));
  const cards = data.questionTypes
    .map((item) => renderCard(item, logoDataUrl, data.footer, weightingById.get(item.id)))
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
    html,body{margin:0;background:#E7E0EC;color:#352F3B;font-family:"Noto Sans SC","Microsoft YaHei",Arial,sans-serif}
    body{padding:40px;display:flex;flex-direction:column;align-items:flex-start;gap:40px}
    .question-card{position:relative;width:900px;height:1200px;overflow:hidden;background:linear-gradient(150deg,#FFFDFC 0%,#FFF9F7 58%,var(--pale) 145%);isolation:isolate}
    .question-card::before{content:"";position:absolute;inset:0 0 auto 0;height:11px;background:linear-gradient(90deg,var(--accent),var(--secondary),#F5C56D);z-index:3}
    .orb{position:absolute;border-radius:999px;z-index:-1;pointer-events:none}
    .orb-one{width:330px;height:330px;right:-135px;top:-130px;background:var(--soft);opacity:.72}
    .orb-two{width:240px;height:240px;left:-115px;bottom:-110px;background:#FFE3C7;opacity:.72}
    .orb-three{width:125px;height:125px;right:58px;bottom:106px;background:#D9EEFF;opacity:.62}
    .card-header{height:112px;padding:25px 46px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(111,85,118,.14)}
    .brand{display:flex;align-items:center;gap:14px}
    .brand img{width:56px;height:56px;object-fit:contain;border-radius:50%;background:#fff;box-shadow:0 6px 18px rgba(61,43,76,.14)}
    .brand div{display:flex;flex-direction:column;gap:1px}
    .brand strong{font-size:24px;line-height:1.25;letter-spacing:.01em}
    .brand small{font-size:16px;color:#6F6573;letter-spacing:.06em;font-weight:600}
    .part-pill{padding:11px 18px;border:1px solid color-mix(in srgb,var(--accent) 30%,white);border-radius:999px;background:rgba(255,255,255,.78);color:var(--accent-strong);font-size:18px;font-weight:800;letter-spacing:.02em;box-shadow:0 6px 16px rgba(73,48,89,.08)}
    .card-content{height:1014px;padding:30px 46px 16px;display:flex;flex-direction:column}
    .overview{min-width:0;display:flex;flex-direction:column}
    .eyebrow{display:flex;align-items:center;gap:10px;color:var(--accent-strong);font-size:16px;font-weight:800;letter-spacing:.12em}
    .eyebrow span{display:grid;place-items:center;min-width:44px;height:32px;padding:0 10px;border-radius:9px;background:var(--accent);color:#fff;font-size:16px;letter-spacing:.02em;box-shadow:0 5px 14px color-mix(in srgb,var(--accent) 28%,transparent)}
    h1{margin:14px 0 0;font-family:Arial,"Noto Sans SC",sans-serif;font-size:43px;line-height:1.08;letter-spacing:-.035em;color:#332C39}
    h2{margin:6px 0 0;color:var(--accent-strong);font-size:30px;line-height:1.25;font-weight:800}
    .task-block{margin-top:18px;padding:14px 20px 15px;border-left:7px solid var(--secondary);border-radius:0 18px 18px 0;background:var(--pale)}
    .task-block h3,.scoring h3{margin:0 0 6px;font-size:24px;line-height:1.25}
    .task-block p{margin:0;color:#463D4A;font-size:22px;line-height:1.48;font-weight:500}
    .facts{margin-top:14px;display:grid;grid-template-columns:1.25fr 1fr .82fr;gap:10px}
    .facts div{min-height:94px;padding:12px 14px;border:1px solid rgba(99,78,103,.18);border-radius:16px;background:rgba(255,255,255,.86);display:flex;flex-direction:column;gap:5px;box-shadow:0 7px 18px rgba(70,51,79,.06)}
    .facts small{color:#6F636F;font-size:16px;font-weight:800;letter-spacing:.04em}
    .facts strong{font-size:20px;line-height:1.34;color:#302936;font-weight:800}
    .scoring{margin-top:16px;min-height:0;flex:1;padding:20px 24px 18px;border:2px solid color-mix(in srgb,var(--accent) 48%,white);border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.64),var(--panel));color:#3D3442;display:flex;flex-direction:column;box-shadow:0 18px 42px rgba(65,45,80,.13)}
    .scoring-topline{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
    .scoring-topline>span{font-family:Arial,sans-serif;color:var(--accent-strong);font-size:16px;font-weight:900;letter-spacing:.16em}
    .scoring-topline b{padding:8px 13px;border-radius:999px;background:var(--accent);color:#fff;font-size:18px;letter-spacing:.02em;box-shadow:0 5px 14px color-mix(in srgb,var(--accent) 28%,transparent)}
    .scoring-body{display:grid;grid-template-columns:1fr;gap:12px;align-items:stretch}
    .scoring-detail{min-width:0;padding:2px 1px}
    .scoring h3{font-size:28px;margin-bottom:9px;color:#332A37}
    .trait-tags{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}
    .trait-tags span{padding:6px 10px;border:1px solid rgba(82,61,91,.17);border-radius:999px;background:rgba(255,255,255,.78);color:var(--accent-strong);font-size:16px;font-weight:800;line-height:1.2}
    .scoring-copy{margin:0;color:#463C4B;font-size:20px;line-height:1.48;font-weight:500}
    .rules-box{padding:14px 16px 13px;border:1px solid rgba(96,76,102,.16);border-radius:19px;background:rgba(255,255,255,.8);color:#352D3A}
    .rules-box h4{margin:0 0 10px;color:var(--accent-strong);font-size:21px;letter-spacing:.04em}
    .rules-box ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .rules-box li{display:flex;align-items:flex-start;gap:8px;font-size:18px;line-height:1.38;font-weight:600}
    .rules-box li b{flex:0 0 27px;height:27px;border-radius:50%;display:grid;place-items:center;background:var(--pale);color:var(--accent-strong);font-size:15px}
    .weighting{margin-top:auto;padding:13px 15px 12px;border:1px solid rgba(92,72,100,.17);border-radius:20px;background:rgba(255,255,255,.86)}
    .weighting-heading{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:9px}
    .weighting-heading>div{display:flex;align-items:baseline;gap:9px}
    .weighting-heading span{font-family:Arial,sans-serif;color:var(--accent-strong);font-size:12px;font-weight:900;letter-spacing:.12em}
    .weighting-heading h4{margin:0;color:#342B39;font-size:20px}
    .weighting-heading>small{color:#6F6573;font-size:14px;font-weight:600}
    .weighting-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
    .weight-cell{min-height:67px;padding:8px 8px 7px;border:1px solid rgba(80,68,88,.13);border-top-width:6px;border-radius:11px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
    .weight-cell small{color:#665B69;font-size:17px;font-weight:800}
    .weight-cell strong{font-family:Arial,"Noto Sans SC",sans-serif;color:#29222E;font-size:31px;line-height:1.05}
    .weight-cell.is-empty{opacity:.42;background:#F7F4F7}
    .weight-overall{border-top-color:#8A66C9}.weight-listening{border-top-color:#6E9EDC}.weight-reading{border-top-color:#48AF96}.weight-speaking{border-top-color:#ED82AA}.weight-writing{border-top-color:#F0A25E}
    .weighting-note{margin:8px 0 0;color:#665C69;font-size:14px;line-height:1.36;font-weight:600}
    footer{height:74px;padding:0 46px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(111,85,118,.14);color:#655B69;font-size:16px;letter-spacing:.01em}
    footer span:first-child{font-weight:600;color:#665B6A}
    footer span:last-child{color:#918795;font-family:Arial,"Noto Sans SC",sans-serif;letter-spacing:.07em}
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
    "每个计分题型同时补充 Pearson 官方 PTE Academic question weighting table 中的 Overall、Listening、Reading、Speaking、Writing 平均权重。百分比是平均测试中的指示性占比，各分数分别计算，不能直接换算为 10–90 分。",
    "",
  ];
  const weightingById = new Map(data.weightingTable.map((row) => [row.id, row]));

  for (const [section, title] of sections) {
    lines.push(`## ${title}`, "");
    for (const item of data.questionTypes.filter((candidate) => candidate.section === section)) {
      const weighting = weightingById.get(item.id);
      const weightingSummary = weighting
        ? WEIGHTING_SKILLS.map(({ key, label }) => `${label} ${weighting[key] ?? "—"}`).join("；")
        : "不计分，未列入官方权重表";
      lines.push(
        `### ${item.name}｜${item.nameZh}`,
        "",
        `- 做什么：${item.task}`,
        `- 题干或材料：${item.prompt}`,
        `- 作答时间：${item.answerTime}`,
        `- 计分技能：${item.skills}`,
        `- 评分方式：${item.scoreType}；${item.scoring}`,
        `- 官方平均权重：${weightingSummary}。`,
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
    "- 图片中的字数、准备时间、录音时间、音频长度和评分项均来自核对日期当天的 Pearson PTE 页面；权重来自 Pearson 的 PTE Academic Scoring Information for Teachers and Partners。",
    "",
    "## 官方页面",
    "",
    `- 总览：${data.officialLandingPage}`,
    "- Speaking & Writing：https://www.pearsonpte.com/pte-academic/test-format/speaking-writing/",
    "- Reading：https://www.pearsonpte.com/pte-academic/test-format/reading/",
    "- Listening：https://www.pearsonpte.com/pte-academic/test-format/listening/",
    `- 官方题型权重表：${data.weightingSource}`,
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
      await Promise.all(Array.from(document.images, (image) => image.decode?.().catch(() => undefined)));
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
        expression: `(async () => {
          const card = document.getElementById(${JSON.stringify(`card-${item.id}`)});
          if (!card) return null;
          card.scrollIntoView({ block: "start", inline: "start" });
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const rect = card.getBoundingClientRect();
          return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
        })()`,
        awaitPromise: true,
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
