# 小红书 WebView Chrome 92 页面未进入业务请求

> 本文由 AI 辅助整理，并由项目负责人审核。日志中的 IP、链接令牌及其他客户信息均已脱敏。

## 摘要

2026-08-04，用户反馈发货链接在桌面 Chrome 中可以正常访问，但在小红书 APP 内置浏览器中只能打开入口，无法正常进入业务流程。

生产日志显示，受影响客户端是 Android 10 上的 WebView Chrome 92。修复前，该客户端能够取得 HTML 和 JavaScript 静态资源，却没有发出页面初始化所需的 `/api/public/<link-token>/status` 请求；同一链接随后在新版桌面 Chromium 中正常请求该接口。项目当时使用 Next.js 16.2.12，且没有自定义 Browserslist，因此采用 Next.js 默认的 Chrome 111+ 支持基线。

项目增加 Chrome 92 构建目标并部署后，同类 WebView 成功执行新版 JavaScript，并连续两次获得状态接口的 HTTP 200 响应。行为层面的兼容性根因由此确认。由于没有取得设备端控制台日志，具体触发失败的 JavaScript 语法或运行时异常没有被精确捕获。

## 用户可见现象

- 桌面 Chrome 可以正常打开发货链接。
- 小红书 APP 内置浏览器无法正常进入业务流程。
- 页面和静态资源返回 HTTP 200，服务端没有相应的业务 API 请求。
- 服务健康检查正常，问题只出现在特定旧版 WebView。

## 证据链

### 修复前

2026-08-04 13:54–13:57（UTC+8）的生产访问日志中，同一个 Android WebView 多次出现以下模式：

1. `GET /g/<redacted>` 返回 200。
2. Next.js JavaScript 静态资源返回 200。
3. 没有出现 `/api/public/<redacted>/status` 请求。
4. 客户端 UA 表明其为华为 Android 10 WebView，内核为 Chrome 92。

随后，同一发货链接在新版桌面 Chromium 中打开，页面加载后立即请求状态接口并获得 HTTP 200。

这组差异将问题范围收敛到浏览器端 JavaScript 启动阶段，而不是 DNS、TLS、nginx、链接有效性或业务 API。

### 修复后

发布于 2026-08-04 16:02:31（UTC+8）的版本包含 Chrome 92 构建目标。2026-08-04 16:06 的真实小红书 WebView 请求链为：

| 时间（UTC+8） | 请求 | 结果 |
| --- | --- | --- |
| 16:06:12 | `GET /g/<redacted>` | 200 |
| 16:06:13 | 新版 JavaScript chunks | 200 |
| 16:06:13 | `GET /api/public/<redacted>/status` | 200 |
| 16:06:13 | 页面图片 | 200 |
| 16:06:38 | 再次打开发货页面 | 200 |
| 16:06:38 | 再次请求状态接口 | 200 |
| 16:06:39 | 中文字体 | 200 |

同一时间窗口没有 Nginx 错误、应用告警或 4xx/5xx 响应。

## 根因与边界

项目使用 Next.js 16.2.12。Next.js 的[浏览器支持说明](https://nextjs.org/docs/architecture/supported-browsers)将现代浏览器作为默认构建基线，其中 Chrome 默认基线高于小红书客户端使用的 Chrome 92。

根因在行为层面已经确认：缺少 Chrome 92 构建目标导致该 WebView 无法完成前端初始化；补充目标后，同类客户端恢复了完整请求链。

仍然未知的细节是设备端具体抛出的异常。此次没有连接 Android 远程调试，也没有取得 WebView 控制台堆栈，因此不能把问题进一步归因到某一个语法、Web API 或单独的 chunk。

## 最小修复

在 [`package.json`](../../package.json) 中显式声明生产浏览器目标：

```json
"browserslist": [
  "chrome 92",
  "edge 111",
  "firefox 111",
  "safari 16.4"
]
```

该方案让 Next.js、Turbopack 和 CSS 转换过程使用同一浏览器基线，同时保留其他浏览器的原有基线。没有引入全量旧浏览器兼容包，也没有修改业务代码。

[`tests/browser-compat.test.ts`](../../tests/browser-compat.test.ts) 同时验证：

- `package.json` 中的目标没有被意外删除或放宽。
- Next.js 生产构建实际解析出的目标与项目配置一致。

## 验证记录

提交 `7ae6e89`（`Support Chrome 92 in production browser builds.`）通过了以下验证：

```shell
npm test
npx tsc --noEmit
npm run build
```

验证结果：58 项测试通过，类型检查通过，生产构建通过。部署 release 为 `20260804T080151Z`，生产发布包读取到的目标为：

```text
chrome 92
edge 111
firefox 111
safari 16.4
```

部署后还确认了以下运维状态：

- 应用内网和公网健康接口均返回 `{"ok":true}`。
- systemd 服务为 `active/running`。
- 归档与备份 timer 均为 enabled。
- 最近一次备份执行成功。
- 管理配置指纹与部署前一致。
- 真实小红书 WebView 完成页面、静态资源和状态接口请求。

## 类似问题的排查顺序

### 1. 固定测试上下文

记录绝对时间、时区、入口类型、设备系统、APP 名称和版本。不要在工单、聊天或提交中粘贴明文链接令牌、完整手机号、订单号或会话 Cookie。

### 2. 确认实际生产链路

先核对域名解析、服务器、nginx upstream、systemd 服务和当前 release，避免在错误主机或旧环境中查日志。

### 3. 关联访问日志

按时间窗口、脱敏后的客户端标识和 UA 关联以下请求：

```text
入口 HTML
  → Next.js JavaScript / CSS
  → 页面初始化 API
  → 图片、字体等延迟资源
```

判断重点：

- HTML 未返回：检查 DNS、TLS、nginx、路由和链接状态。
- HTML 返回而静态资源失败：检查 release 资产、缓存和反向代理。
- HTML 与静态资源均返回，但没有初始化 API：优先检查 JavaScript 启动失败和浏览器兼容性。
- 初始化 API 已返回错误：进入对应业务 API、鉴权或数据状态排查。

### 4. 比较正常客户端

使用同一入口在正常浏览器中复测，并比较请求序列。只比较“页面能否显示”容易遗漏 JavaScript 没有继续执行的情况；业务初始化 API 是否出现是更可靠的分界点。

### 5. 核对构建目标

检查 `package.json` 的 Browserslist，并确认 Next.js 实际解析结果：

```shell
node -e "const { getSupportedBrowsers } = require('next/dist/build/get-supported-browsers'); console.log(getSupportedBrowsers(process.cwd(), false).join('\n'))"
```

不要仅根据 UA 添加 polyfill。先确认构建工具是否已经按目标转换 JavaScript 和 CSS，再判断是否存在需要单独处理的运行时 Web API。

### 6. 分层验收

依次完成：

1. 自动化测试和生产构建。
2. 生产发布包目标核对。
3. 带旧版 UA 的 HTTP 冒烟请求。
4. 真实 APP WebView 执行 JavaScript 并调用业务 API。
5. 同一时间窗口的 Nginx 与应用错误日志复核。

UA 冒烟请求只能证明服务器愿意返回页面，不能证明 WebView 可以执行其中的 JavaScript。真实设备请求到业务初始化 API 才是最终验收信号。

## 日志与隐私处理

- 原始生产日志只下载到 Git 忽略的 `.tmp/`，不得提交。
- 分析输出以摘要或短哈希代替 IP。
- 路径中的发货链接令牌统一显示为 `<redacted>`。
- 不输出完整手机号、订单号、验证码、会话令牌或后台凭据。
- 进入文档的时间线只保留定位问题所需的状态码、资源类型和 UA 版本。

## 回滚与后续观察

如果显式 Chrome 92 目标导致构建体积或性能出现不可接受的回归，应使用标准 release 回滚流程恢复上一版本，并保留真实 WebView 的失败证据。不要通过修改生产静态文件或临时 UA 判断绕过构建配置。

后续升级 Next.js、Turbopack 或 CSS 工具链时，保留浏览器目标测试，并用真实小红书 WebView 复验入口加载和状态接口请求。
