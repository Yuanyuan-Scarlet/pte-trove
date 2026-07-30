# 端到端验收用例

> 本文档由 AI 辅助整理，并由项目负责人审核。

本文档固化管理员上传、发布、买家生成与下载的网页验收流程。业务规则以 [`../SPEC.md`](../SPEC.md) 为准；自动化覆盖由 `tests/**/*.test.ts` 与 `tests/e2e.integration.mjs` 提供。

## 1. 测试环境

- Node.js：`.nvmrc` 指定的版本。
- 运行模式：生产构建的 standalone server。
- 数据：独立的临时 `APP_DATA_DIR`，不得复用生产数据库或客户资料。
- 短信：本地使用 `SMS_MODE=mock` 和非生产 `ENVIRONMENT`；生产环境必须使用阿里云短信。
- 浏览器：Chrome DevTools MCP，管理员与各买家场景使用不同 isolated context。
- 测试结束后停止本地服务；测试 PDF、生成文件和数据库不得提交到 Git。

### 1.1 真实资料基准

真实 PDF 由测试人员在仓库外提供。以下清单用于确认输入没有变化：

| 题型 | 文件名 | 字节数 | 页数 | SHA-256 |
| --- | --- | ---: | ---: | --- |
| WFD | `WFD_.pdf` | 3,318,690 | 37 | `91cc05575622e3dc1146692738ba7f659fa60509b264d24f3292eef2304b162f` |
| DI | `DI_.pdf` | 53,114,013 | 302 | `5b308af3aba7489facb461719e473cba451c3b691ab505bb67b9565e531f75cd` |
| SST | `SST_.pdf` | 5,928,758 | 60 | `052e16ff525aed1d638271b0b91b912b41e1ac656670a777dbdf6db8e77aae3f` |
| RS | `RS_.pdf` | 2,719,034 | 24 | `9dfb60422bcade562d537cbd4a1f63a3e4d5bb9ca35638f11e969ccafd73ab8e` |
| WE | `WE_.pdf` | 5,173,731 | 92 | `dc4c27ce4ce0831289a88dd13238867df835edc02c147741c461b1655d0a6550` |

## 2. 管理员流程

### WEB-E2E-001：standalone 页面资源完整

前置条件：执行 `npm run build` 和 `npm run start`。

步骤：

1. 开发环境打开 `/admin`；生产环境打开 root-only 凭据文件记录的高熵管理 URL。
2. 检查品牌图片、CSS、JavaScript 和登录表单。
3. 查看控制台与网络请求。

预期：页面完整渲染；`public/` 与 `/_next/static/` 资源无 404；控制台无阻断错误。

自动化映射：`tests/standalone.test.ts`。

### WEB-E2E-002：管理员登录支持 standalone 与反向代理来源

步骤：输入测试管理员账号和密码并登录；生产环境同时验证固定 `/admin` 和缺少入口密钥的登录请求。

预期：正确高熵入口登录成功；生产固定 `/admin` 与缺少/错误入口密钥均返回 404；非默认账号和强随机密码通过摘要校验；本地 Host 与 nginx 转发的 HTTPS 公网来源均通过同源校验；跨域写请求返回 403；登录接口同时受应用与 nginx 限流。

自动化映射：`tests/admin-security.test.ts`、`tests/http.test.ts`、`tests/deploy-scripts.test.ts`。

### WEB-E2E-003：创建草稿并上传五类真实 PDF

步骤：

1. 创建一个新资料版本。
2. 依次上传 WFD、DI、SST、RS、WE。
3. 核对文件名、页数、大小和草稿文件计数。

预期：

- WFD、SST、RS、WE 页面提示最大 50MB；DI 提示最大 100MB。
- 五个文件均按真实资料基准显示页数和大小。
- `DI_.pdf` 的 53,114,013 字节上传成功。
- 五项齐全前发布按钮禁用，达到 5/5 后启用。

自动化映射：`tests/upload-limits.test.ts`、`tests/pdf.test.ts`。

### WEB-E2E-004：发布生成六个入口并独立计时

步骤：点击“发布并生成链接”并确认。

预期：

- 生成 WFD、DI、SST、RS、WE、五项合集六个独立入口。
- 停止新增生成时间等于发布时间加 240 小时。
- 链接失效时间等于发布时间加 720 小时。
- 生成的 URL 使用浏览器/代理公网 Origin，不出现内部监听地址。

自动化映射：`tests/domain.test.ts`、`tests/e2e.integration.mjs`、`tests/http.test.ts`。

## 3. 买家流程

### WEB-E2E-005：模拟短信只在开发环境显示

步骤：在本地买家页输入有效中国大陆手机号并获取验证码。

预期：本地 mock 模式显示“开发预览验证码”；生产环境即使误设 mock 也返回 503，响应中不得出现验证码，失败挑战不得留在数据库。

自动化映射：`tests/sms-security.test.ts`。

### WEB-E2E-006：真实大 DI 生成、状态与下载一致

步骤：

1. 打开真实资料版本的 DI 入口。
2. 输入未使用的有效手机号、验证码和 `P` 加 18 位数字的订单号。
3. 提交生成并等待成功页。
4. 下载专属文件。

预期：

- 页面只在任务为 `SUCCEEDED`、文件记录为 `ACTIVE`、磁盘文件存在且大小匹配后显示成功。
- 文件名为 `PTE突击宝藏资料-DI.pdf`。
- 下载响应为 200 和 `application/pdf`。
- 下载字节数与数据库 `file_size`、磁盘文件大小一致。
- PDF 可打开且保持 302 页，每页具有“祝考试好运 UPUP”、完整手机号、中央浅色 Logo 和右下角不透明 Logo。

本次水印修复基准结果：生成文件 54,370,597 字节，302 页。基准使用测试手机号；生产验收不得在文档或日志中记录实际手机号。

自动化映射：`tests/generated-readiness.test.ts`、`tests/pdf.test.ts`、`tests/e2e.integration.mjs`。

### WEB-E2E-007：文件缺失或大小异常绝不显示成功

步骤：在隔离测试数据中分别模拟生成文件缺失和实际大小不符，然后请求状态。

预期：`ready=false`；文件记录变为 `MISSING`；任务变为 `FAILED/FILE_MISSING`；同一手机号和订单号再次验证后可重新生成，且每个生成任务仍只有一条文件记录。

自动化映射：`tests/generated-readiness.test.ts`。

### WEB-E2E-008：重复进入与下载保持幂等

步骤：成功后刷新页面并重复下载。

预期：仍返回同一文件；绑定数、任务数、有效文件数均为 1；`attempt_count` 不增加。

自动化映射：`tests/e2e.integration.mjs`、`tests/generated-readiness.test.ts`。

### WEB-E2E-009：入口会话隔离

步骤：在已验证 DI 的同一浏览器 context 中打开同版本 WFD 入口。

预期：WFD 仍显示验证表单；DI Cookie 不得授权 WFD、其他版本或其他买家文件。

自动化映射：`tests/e2e.integration.mjs`；网页验收需使用 isolated context 复核。

### WEB-E2E-010：手机号与订单号双向一对一

步骤：

1. 用第二个手机号提交已经绑定的订单号。
2. 用已经绑定的手机号提交第二个订单号。

预期：分别显示“订单号已经绑定过手机号”和“手机号已经绑定过订单号”；不得创建第二个绑定、任务或文件。

自动化映射：`tests/schema.test.ts`、`tests/e2e.integration.mjs`。

### WEB-E2E-011：未授权下载的页面与 API 语义

步骤：

1. 在匿名 context 中直接打开 `/api/public/{token}/download`。
2. 在页面脚本中以 `Accept: application/json` 请求同一接口。

预期：

- 浏览器导航收到 303，并进入 `/g/{token}` 验证页。
- 页面显示一次性 Toast：“请先验证手机号和订单号，再下载专属文件”。
- Toast 触发片段被立即从 URL 清理。
- 程序化请求保持 401 JSON，错误码为 `BUYER_AUTH_REQUIRED`。

自动化映射：`tests/download-auth.test.ts`。

### WEB-E2E-012：五项合集 ZIP

步骤：使用新的手机号和订单号完成五项合集生成并下载 ZIP。

预期：ZIP 只包含五个固定公开文件名；每个 PDF 保持原页数，每页具有祝福语、完整手机号、中央浅色 Logo 和右下角不透明 Logo；重复下载不重新生成。

自动化映射：`tests/pdf.test.ts`、`tests/e2e.integration.mjs`。

## 4. 部署后只读冒烟

部署后先执行不会污染生产业务数据的检查：

1. `/api/health` 返回 200。
2. 高熵管理 URL 完整渲染且静态资源无 404，固定 `/admin` 返回 404。
3. 未授权下载浏览器导航执行 303 并显示 Toast；程序化请求仍为 401。
4. systemd 服务为 active，3100 仅监听回环地址。
5. nginx 配置检查通过，HTTPS 证书有效，HTTP 跳转 HTTPS。
6. 归档与备份 timer 已启用，最近一次备份服务成功。

生产管理员写操作、真实短信发送、真实资料发布和买家生成会改变外部状态，应使用专门验收数据并获得明确授权后执行。

## 5. 标准验证命令

以下命令在 Windows PowerShell、Linux Bash 和 macOS zsh/Bash 中写法相同，均从仓库根目录执行：

```shell
npm test
npm run lint
npx tsc --noEmit
npm run build
```

API 级端到端测试需先启动隔离本地服务，再执行：

```shell
node tests/e2e.integration.mjs
```

## 6. 生产端到端执行记录（2026-07-30）

生产验收版本：`生产端到端验收 2026-07-30`。验收使用专门测试买家数据，本文不记录手机号、验证码、订单号、管理入口或商品链接令牌。

### 后台原件

- WFD：3,318,690 字节，37 页。
- DI：53,114,013 字节，302 页。
- SST：5,928,758 字节，60 页。
- RS：2,719,034 字节，24 页。
- WE：5,173,731 字节，92 页。
- 数据库汇总：5 个原件、70,254,226 字节、515 页。
- 发布、买家生成和成品替换前后汇总保持一致，确认后台原件始终无水印且未被覆盖。

### 买家五项合集

- Chrome DevTools MCP 页面状态：已认证、`BUNDLE`、`SUCCEEDED`、`ready=true`。
- 修复后的 ZIP：75,114,957 字节，`application/zip`。
- 数据库记录为 `ACTIVE`，磁盘大小与数据库一致，SHA-256 一致。
- 原子替换后生成目录只保留一个文件，旧的错误成品已删除。
- 生成次数由修复性重生成增加到 2；验收者随后重复下载并人工确认水印正常，次数仍为 2，验证下载幂等。
- ZIP 内五个 PDF 均具有“祝考试好运 UPUP”、完整手机号、中央约 2% 透明度 Logo 和右下角不透明 Logo。
- 本地真实资料抽检每个 PDF 的首、中、末页，共 15 页：页数匹配、祝福语和手机号可提取、逐字符实际落墨、页面像素发生可见变化。

### 运行状态

- 应用健康检查返回 200，systemd 应用服务为 `active/running`。
- 备份脚本权限恢复为 `0755`，备份服务结果为 `success` 并生成新 SQLite 备份。
- 生产 release：`20260729T174216Z`。
