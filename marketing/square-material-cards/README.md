# PTE 五项资料 1:1 营销图

> 本套素材由 AI 辅助设计与排版，并由项目负责人审核。

本目录保存 WFD、DI、SST、RS、WE 五种 PTE 资料的方形营销介绍图，主要用于电商平台手机端顶部轮播。排版以图片缩小到约 375 像素屏幕宽度后的可读性为基准，使用大字号、高对比度和高画布占用率，避免无意义留白。每个题型包含 5 张 1080 × 1080 像素 PNG：

1. `cover`：资料封面与核心定位。
2. `facts`：题型时限、流程和训练重点。
3. `structure`：资料内容与学习抓手。
4. `preview`：现有详情页中的真实资料内页。
5. `sprint`：三步练习路径与购买引导。

`cards.json` 是唯一可编辑的卡片文案与结构数据源，`index.html` 是生成的本地预览页，PNG 是可直接用于营销的最终导出图。`index.html` 和全部 PNG 均已加入 `.gitignore`，只保留在本地，不提交到 Git。文字与事实依据来自 `../detail-pages/`；商品主图来自 `../product-images/`；真实截图来自 `../detail-pages/screenshots/`。

## 重新生成

从仓库根目录执行：

```shell
npm run marketing:square-cards
```

只生成部分题型：

```shell
npm run marketing:square-cards -- --only wfd,di
```

所有输出均为 1:1 PNG，文件名示例：

```text
wfd-01-cover.png
wfd-02-facts.png
wfd-03-structure.png
wfd-04-preview.png
wfd-05-sprint.png
```

脚本使用本机 Chrome 或 Edge。若浏览器不在常见安装路径，可通过 `--browser` 或 `PTE_SCREENSHOT_BROWSER` 指定。

## 内容维护

- 修改营销文案时同步核对对应的 `detail-pages/<题型>.html`，不新增无法从现有资料支撑的价格、命中率、认证或效果承诺。
- 手机端轮播是第一使用场景；正文、标签和数字在 1080 像素源图中应保持足够字号，核心卖点不要依赖细小脚注表达。
- 真实内页卡只使用项目已有截图，避免生成式图像改变资料内容。
- 修改 `cards.json` 后重新生成全部图片，并运行测试检查题型数量、卡片数量、图片尺寸和素材引用。
