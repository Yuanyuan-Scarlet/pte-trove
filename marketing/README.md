# 商品营销素材

> 本文档由 AI 辅助整理，并由项目负责人审核。

`marketing/` 保存小圆 PTE 商品展示素材，包括六张商品主图、五个题型与一个五项合集 HTML 详情页、供商家后台直接上传的连续竖图，以及 PTE Academic 全题型简介图。

## 目录结构

| 路径 | 用途 |
| --- | --- |
| `product-images/` | WFD、DI、SST、RS、WE 和五项合集商品主图 |
| `detail-pages/` | 五个题型与五项合集的 HTML 详情页、共享样式和页面内展示截图 |
| `detail-page-images/` | 从六个 HTML 详情页生成的商家后台连续竖图 |
| `pte-academic-question-types/` | 22 个计分题型与 Personal Introduction 的核对稿、数据源和 4:3 简介图 |
| `../scripts/generate-marketing-images.mjs` | 竖图生成脚本 |
| `../scripts/generate-pte-question-cards.mjs` | PTE Academic 全题型简介图生成脚本 |

HTML 详情页是可编辑源文件，`detail-page-images/` 是生成结果。修改详情页文字、样式或图片后，应重新运行生成命令，不要单独手工修改输出 PNG。

PTE Academic 全题型资料以 `pte-academic-question-types/question-types.json` 为唯一数据源，修改后运行 `npm run marketing:pte-cards`，同步更新核对稿、预览页和 23 张 PNG。

## 五项合集详情页

五项合集源文件为 `detail-pages/bundle.html`，顶部沿用单项详情页结构，并使用 `product-images/bundle-main.png` 作为 1:1 商品主图。主图下方按以下顺序拼接五项单品内容：

1. DI
2. WFD
3. WE
4. SST
5. RS

每项内容保留对应单品主题色。合集页面末尾只保留一次统一的领取流程、合集购买引导和版权声明。

合集中的五项正文来自对应单项 HTML，但当前为静态副本，不会自动同步。修改 `di.html`、`wfd.html`、`we.html`、`sst.html` 或 `rs.html` 的商品主图下方内容时，必须同步更新 `bundle.html` 中对应部分，再重新生成竖图。自动测试会检查五项正文完整性、排列顺序以及领取流程是否仅出现一次。

## 生成全部竖图

从仓库根目录执行以下跨平台命令：

```shell
npm run marketing:images
```

脚本依次处理 WFD、DI、SST、RS、WE 和五项合集，默认输出到 `marketing/detail-page-images/`：

```text
wfd-01.png
...
di-01.png
...
sst-01.png
...
rs-01.png
...
we-01.png
...
bundle-01.png
...
```

默认规则：

- 每张图片为 900 × 1600 像素 PNG。
- 切片从页面顶部开始，前一张的结束位置等于后一张的开始位置，不遗漏、不重叠。
- 最后一张使用页面底色补齐到统一高度。
- 重新生成前只清理对应商品原有的编号 PNG，不删除目录中的其他文件。
- 页面引用的任一图片加载失败时，生成立即报错，避免输出缺图版本。

## 自定义生成

指定图片尺寸：

```shell
node scripts/generate-marketing-images.mjs --width 1080 --height 1920
```

只生成部分商品，支持 `wfd`、`di`、`sst`、`rs`、`we` 和 `bundle`：

```shell
node scripts/generate-marketing-images.mjs --only wfd,di
```

提高输出像素密度，同时保持页面排版宽度不变：

```shell
node scripts/generate-marketing-images.mjs --scale 2
```

查看全部参数：

```shell
node scripts/generate-marketing-images.mjs --help
```

`--output` 必须指向 `marketing/` 内的目录，避免误清理项目外文件。例如：

```shell
node scripts/generate-marketing-images.mjs --output marketing/detail-page-images-review
```

## 浏览器要求

脚本使用本机 Chrome 或 Edge 的无头渲染能力，无需安装 Playwright 或 Puppeteer。它会检查 Windows、macOS 和 Linux 的常见安装位置，也会搜索 `PATH`。

如果浏览器安装在其他位置，可以直接传入路径：

Windows PowerShell：

```powershell
node scripts/generate-marketing-images.mjs --browser "D:\Apps\Chrome\chrome.exe"
```

Linux/macOS：

```bash
node scripts/generate-marketing-images.mjs --browser "/opt/google/chrome/chrome"
```

也可以设置 `PTE_SCREENSHOT_BROWSER` 环境变量：

Windows PowerShell：

```powershell
$env:PTE_SCREENSHOT_BROWSER = "D:\Apps\Chrome\chrome.exe"
npm run marketing:images
```

Linux/macOS：

```bash
export PTE_SCREENSHOT_BROWSER="/opt/google/chrome/chrome"
npm run marketing:images
```

## 商家后台上传

同一商品按文件编号从小到大上传，例如 WFD 使用 `wfd-01.png`、`wfd-02.png`、`wfd-03.png`，五项合集使用 `bundle-01.png`、`bundle-02.png`、`bundle-03.png`。五个题型与五项合集分别维护自己的图片序列，HTML 页面长度变化后，输出张数可能随之变化，应以最新一次生成结果为准。
