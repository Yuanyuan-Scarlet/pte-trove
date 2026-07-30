# 商品营销素材

> 本文档由 AI 辅助整理，并由项目负责人审核。

`marketing/` 保存小圆 PTE 商品展示素材，包括六张商品主图、五个题型 HTML 详情页，以及供商家后台直接上传的连续竖图。

## 目录结构

| 路径 | 用途 |
| --- | --- |
| `product-images/` | WFD、DI、SST、RS、WE 和五项合集商品主图 |
| `detail-pages/` | 五个题型的 HTML 详情页、共享样式和页面内展示截图 |
| `detail-page-images/` | 从五个 HTML 详情页生成的商家后台连续竖图 |
| `../scripts/generate-marketing-images.mjs` | 竖图生成脚本 |

HTML 详情页是可编辑源文件，`detail-page-images/` 是生成结果。修改详情页文字、样式或图片后，应重新运行生成命令，不要单独手工修改输出 PNG。

## 生成全部竖图

从仓库根目录执行以下跨平台命令：

```shell
npm run marketing:images
```

脚本依次处理 WFD、DI、SST、RS 和 WE，默认输出到 `marketing/detail-page-images/`：

```text
wfd-01.png
wfd-02.png
...
di-01.png
...
we-04.png
```

默认规则：

- 每张图片为 900 × 1600 像素 PNG。
- 切片从页面顶部开始，前一张的结束位置等于后一张的开始位置，不遗漏、不重叠。
- 最后一张使用页面底色补齐到统一高度。
- 重新生成前只清理对应题型原有的编号 PNG，不删除目录中的其他文件。
- 页面引用的任一图片加载失败时，生成立即报错，避免输出缺图版本。

## 自定义生成

指定图片尺寸：

```shell
npm run marketing:images -- --width 1080 --height 1920
```

只生成部分题型：

```shell
npm run marketing:images -- --only wfd,di
```

提高输出像素密度，同时保持页面排版宽度不变：

```shell
npm run marketing:images -- --scale 2
```

查看全部参数：

```shell
npm run marketing:images -- --help
```

`--output` 必须指向 `marketing/` 内的目录，避免误清理项目外文件。例如：

```shell
npm run marketing:images -- --output marketing/detail-page-images-review
```

## 浏览器要求

脚本使用本机 Chrome 或 Edge 的无头渲染能力，无需安装 Playwright 或 Puppeteer。它会检查 Windows、macOS 和 Linux 的常见安装位置，也会搜索 `PATH`。

如果浏览器安装在其他位置，可以直接传入路径：

Windows PowerShell：

```powershell
npm run marketing:images -- --browser "D:\Apps\Chrome\chrome.exe"
```

Linux/macOS：

```bash
npm run marketing:images -- --browser "/opt/google/chrome/chrome"
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

同一题型按文件编号从小到大上传，例如 WFD 使用 `wfd-01.png`、`wfd-02.png`、`wfd-03.png`、`wfd-04.png`。五个题型分别维护自己的图片序列，HTML 页面长度变化后，输出张数可能随之变化，应以最新一次生成结果为准。
