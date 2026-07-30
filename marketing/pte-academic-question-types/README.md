# PTE Academic 全题型简介图

> 本资料由 AI 辅助整理，并由项目负责人审核。

本目录保存依据 Pearson PTE 官网整理的 PTE Academic 题型资料与 4:3 简介图。内容核对日期为 2026-07-31；当前范围为 22 个计分题型，以及 1 个不计分的 Personal Introduction，共 23 张图片。

## 文件说明

| 路径 | 用途 |
| --- | --- |
| `question-types.json` | 唯一可编辑的数据源，包含题型流程、材料长度、时限、技能和评分规则 |
| `question-types.md` | 由数据源生成的人工核对稿 |
| `index.html` | 由数据源生成的全部卡片预览页 |
| `cards/` | 23 张 1200 × 900 像素 PNG |
| `../../scripts/generate-pte-question-cards.mjs` | 生成核对稿、预览页和 PNG 的脚本 |

`question-types.md` 和 `index.html` 是生成文件。需要改内容时，先修改 `question-types.json`，再重新运行生成脚本，避免三份内容不一致。

## 重新生成

从仓库根目录执行：

```shell
npm run marketing:pte-cards
```

脚本使用本机 Chrome 或 Edge，无需安装 Playwright 或 Puppeteer。输出文件按考试部分和官网顺序命名：

```text
p1-00-personal-introduction.png
p1-01-read-aloud.png
...
p2-01-fill-blanks-dropdown.png
...
p3-08-write-from-dictation.png
```

每张图片固定为 1200 × 900 像素，左上角使用项目批准的小圆 PTE 圆形 Logo，底部统一显示：

```text
designed　小圆PTE突击，根据Pearson官网信息整理。
```

## 内容维护

- 发布前重新访问三个官方题型页面，核对题型数量、时长、材料长度、计分技能和评分项。
- 官网出现矛盾时，在 `question-types.md` 的核对备注中记录具体位置和采用依据。
- 资料使用重新组织的中文摘要，不保存大段 Pearson 原文。
- 页面把单题时间标为 `Not applicable` 时，卡片写作“未设单题时长”；这仍受对应考试部分总时长约束。

官方页面：

- https://www.pearsonpte.com/pte-academic/test-format/speaking-writing/
- https://www.pearsonpte.com/pte-academic/test-format/reading/
- https://www.pearsonpte.com/pte-academic/test-format/listening/
