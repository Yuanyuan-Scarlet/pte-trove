# 小圆 PTE 突击宝藏资料系统

> 本文档由 AI 辅助整理，并由项目负责人审核。

面向小红书资料买家的 PTE 复习资料自动交付系统。管理员上传并发布 WFD、DI、SST、RS、WE 五项无水印 PDF 后，系统为五个单项和五项合集生成六个独立入口；买家通过中国大陆手机号、阿里云短信验证码和小红书订单号完成验证，获得逐页带专属水印的 PDF 或 ZIP。

生产站点：<https://bzzl.ysspark.cn>

产品与工程规则以 [`SPEC.md`](SPEC.md) 为准；本文用于快速理解、开发、测试和部署项目。

## 命令与路径约定

- 除非另有说明，命令都从仓库根目录执行。
- 标记为 `shell` 的命令在 Windows PowerShell、Linux Bash 和 macOS zsh/Bash 中写法相同。
- 平台语法不同时，文档分别给出“Windows PowerShell”和“Linux/macOS”版本。
- 文档中的仓库相对路径统一使用 `/`；Windows PowerShell 也支持这种写法。生产部署章节中的 `/etc`、`/var`、`/opt` 等绝对路径属于远端 Debian 服务器，不是本机路径。

## 核心业务流程

```text
管理员登录高熵后台
        ↓
创建资料版本并上传五份无水印原始 PDF
        ↓
发布版本，生成 WFD / DI / SST / RS / WE / 五项合集六个入口
        ↓
买家输入手机号、短信验证码和小红书订单号
        ↓
系统建立手机号与订单号的一对一绑定
        ↓
从无水印原件生成该买家的逐页水印副本
        ↓
返回单项 PDF 或包含五个 PDF 的合集 ZIP
```

### 原件与买家成品的边界

- 管理员上传的是无水印原始 PDF，始终保存在服务器私有目录中。
- 买家生成时只读取原件，不覆盖、不改写原件。
- 单项入口生成一份带当前买家水印的 PDF。
- 五项合集入口分别生成五份带当前买家水印的 PDF，再打包为 ZIP。
- 已成功生成的买家重复进入或下载时复用同一成品，不重复执行水印流程。
- 原件、生成文件、历史资料和 `old-sold` 均不得放入公网静态目录或提交到 Git。

## 关键业务规则

| 规则 | 当前实现 |
| --- | --- |
| 资料类型 | WFD、DI、SST、RS、WE |
| 商品入口 | 五个单项入口和一个 `BUNDLE` 五项合集入口 |
| 发布要求 | 一个版本必须上传并校验五份 PDF 后才能发布 |
| 新生成窗口 | 发布时间起连续 240 小时 |
| 链接与下载窗口 | 发布时间起连续 720 小时 |
| 买家身份 | 中国大陆手机号、短信验证码、小红书 `P` 加 18 位数字订单号 |
| 绑定约束 | 同一版本和入口下，手机号与订单号双向一对一 |
| 水印文字 | “祝考试好运 UPUP”与完整 11 位手机号 |
| Logo 水印 | 页面中央浅色 Logo 和右下角不透明小 Logo |
| 合集内容 | 五个固定公开文件名的水印 PDF |
| 手动补发 | 后台选择版本和入口，输入称呼与电话生成水印文件并下载；电话不校验格式，第一行水印为「祝{称呼}考试好运 UPUP」 |
| 文件归档 | 生成满 720 小时后移入私有 `old-sold`（含手动生成文件），不自动永久删除 |

水印覆盖每一页，保持原页面顺序和页数。订单号不会写入水印。

## 技术架构

| 层级 | 技术与职责 |
| --- | --- |
| Web 应用 | Next.js 16、React 19、TypeScript，包含买家端、管理后台和 Route Handlers |
| 服务运行时 | Node.js standalone server，由 systemd 管理 |
| 反向代理 | nginx 提供 HTTPS、请求体限制、登录限流和反向代理 |
| 数据库 | SQLite WAL，保存版本、资料、链接、绑定、验证码、会话和生成状态 |
| 文件存储 | 阿里云轻量服务器私有磁盘，原件与生成文件不经过 `public/` |
| PDF 处理 | `pdf-lib`、Fontkit、Noto Sans SC，逐页添加文字和双 Logo 水印 |
| ZIP 处理 | `fflate`，为五项合集生成固定内容的 ZIP |
| 短信 | 阿里云短信 SendSms API；开发环境支持受控 mock 模式 |
| 运维 | systemd timer 每日执行文件归档和 SQLite 在线备份 |

当前生产架构部署在阿里云轻量应用服务器。本项目不依赖 Cloudflare Workers、D1、R2、Wrangler 或其他 Serverless 运行时。

## 目录结构

| 目录 | 用途 |
| --- | --- |
| `app/` | 页面、动态管理路由和服务端 API |
| `components/` | 管理端与买家端 React 组件 |
| `lib/` | 认证、短信、业务规则、SQLite、PDF、ZIP 和私有存储 |
| `db/`、`drizzle/` | 数据库结构与迁移定义 |
| `public/` | 可公开访问的品牌、字体和水印静态资产，不存业务 PDF |
| `marketing/` | 商品主图、五个题型详情页、商家后台连续竖图及其生成说明 |
| `scripts/` | standalone 资产准备、归档和运维工具 |
| `deploy/` | 阿里云、nginx、systemd、备份和发布脚本 |
| `tests/` | 单元、集成、安全、部署和端到端验收用例 |

## 本地开发

### 1. 准备环境

- Node.js 22.13 或 Node.js 24 以上。
- 推荐使用 `.nvmrc` 指定的 Node.js 26.3.0。
- npm 使用仓库内的 `package-lock.json`。

以下安装命令跨平台通用：

```shell
npm install
```

复制本地环境文件：

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

Linux/macOS：

```bash
cp .env.example .env.local
```

### 2. 配置开发环境

编辑 `.env.local`：

- 为 `APP_SECRET` 设置至少 32 个随机字符。
- 保持 `ENVIRONMENT=development`。
- 保持 `SMS_MODE=mock`，避免本地测试发送真实短信。
- 开发管理入口可以使用 `ADMIN_ROUTE=admin`。
- 设置开发管理员用户名，并为密码生成 PBKDF2 摘要。

生成管理员密码摘要：

```shell
npm run admin:hash
```

命令会交互式读取至少 12 位密码。将输出完整复制到 `.env.local` 的 `ADMIN_PASSWORD_HASH`，不要把明文密码写入仓库。

### 3. 启动应用

```shell
npm run dev
```

- 买家首页：<http://localhost:3000>
- 开发管理后台：<http://localhost:3000/admin>
- 默认开发数据目录：`.data/`

mock 短信验证码只允许在非生产环境返回给开发页面；`ENVIRONMENT=production` 时系统拒绝使用 mock 短信，避免开发验证码进入生产。

## 环境变量

仓库仅提供不含真实密钥的 [`.env.example`](.env.example)。主要变量如下：

| 变量 | 说明 |
| --- | --- |
| `ADMIN_ROUTE` | 管理入口路径；生产必须为 `manage-` 加 48 位小写十六进制字符 |
| `ADMIN_USERNAME` | 单管理员用户名；生产不得使用 `admin` 等默认账号 |
| `ADMIN_PASSWORD_HASH` | `npm run admin:hash` 生成的 PBKDF2 摘要 |
| `APP_SECRET` | 会话、链接和验证码相关的高熵应用密钥 |
| `APP_DATA_DIR` | SQLite、原件、生成文件和归档文件的私有数据根目录 |
| `DATABASE_PATH` | 可选 SQLite 路径；留空时使用 `APP_DATA_DIR/db/prep-trove.sqlite3` |
| `SMS_MODE` | 开发使用 `mock`，生产必须使用 `aliyun` |
| `ALIBABA_CLOUD_SMS_ACCESS_KEY_ID` | 阿里云短信 AccessKey ID |
| `ALIBABA_CLOUD_SMS_ACCESS_KEY_SECRET` | 阿里云短信 AccessKey Secret |
| `SMS_SIGN_NAME` | 已审核通过的短信签名 |
| `SMS_TEMPLATE_CODE` | 已审核通过的验证码模板代码 |
| `SMS_TEMPLATE_VARIABLE` | 模板中的验证码变量名，默认 `code` |
| `SMS_REGION_ID` | 阿里云短信区域，默认 `cn-hangzhou` |
| `ENVIRONMENT` | `development` 或 `production` |

生产环境变量存放在服务器 `/etc/prep-trove.env`，不得提交到 Git。该文件是 systemd `EnvironmentFile`，密码摘要可能包含 `$`，不要使用 `source` 或 `.` 将整份文件当作 Shell 脚本执行。

## 上传与输出限制

| 类型 | 管理员上传上限 | 买家输出 |
| --- | ---: | --- |
| WFD | 50 MiB | `PTE突击宝藏资料-WFD.pdf` |
| DI | 100 MiB | `PTE突击宝藏资料-DI.pdf` |
| SST | 50 MiB | `PTE突击宝藏资料-SST.pdf` |
| RS | 50 MiB | `PTE突击宝藏资料-RS.pdf` |
| WE | 50 MiB | `PTE突击宝藏资料-WE.pdf` |
| 五项合集 | 不单独上传 | `PTE突击宝藏资料-五项合集.zip` |

应用层与 nginx 均配置了适配 DI 大文件的请求体限制。生产服务器内存有限，PDF 水印生成在单进程内串行执行，避免多个大文件同时处理耗尽内存。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动本地开发服务器 |
| `npm test` | 运行领域、数据库、PDF、鉴权、安全和部署测试 |
| `npm run lint` | 运行 ESLint |
| `npm run marketing:images` | 将五个营销 HTML 页面生成商家后台使用的连续竖图 |
| `npx tsc --noEmit` | TypeScript 类型检查，不写输出 |
| `npm run build` | 创建 Next.js production standalone 构建 |
| `npm run start` | 启动 `.next/standalone/server.js` |
| `npm run test:all` | 先构建，再运行自动化测试 |
| `npm run archive` | 执行到期原件和生成文件归档 |
| `npm run db:generate` | 根据 Drizzle 结构生成迁移 |
| `npm run admin:hash` | 交互式生成管理员 PBKDF2 密码摘要 |

`npm run build` 会把 `public/` 和 `.next/static/` 复制到 `.next/standalone/`，生产环境直接运行 standalone server。

## 测试与验收

提交前至少执行：

```shell
npm test
npm run lint
npx tsc --noEmit
npm run build
```

自动化覆盖包括：

- 240 小时生成边界和 720 小时失效边界。
- 手机号、订单号格式与双向唯一绑定。
- 验证码频率、错误次数和生产 mock 防护。
- 管理入口、登录限流、会话和同源校验。
- 未授权浏览器下载 303 跳转与 API 401 语义。
- 文件缺失或大小异常时禁止显示成功。
- 水印、Logo、页面数量、ZIP 内容和生成幂等。
- DI 100 MiB 与其他类型 50 MiB 上传限制。
- standalone、systemd、nginx、备份和发布脚本约束。

API 级端到端测试需要先启动一套隔离的本地服务，并准备有效的 `.tmp/e2e-source.pdf`。测试进程需要使用与本地服务一致的 `ADMIN_ROUTE`、`ADMIN_USERNAME` 和明文测试密码：

Windows PowerShell：

```powershell
$env:E2E_BASE_URL = "http://localhost:3000"
$env:ADMIN_ROUTE = "admin"
$env:ADMIN_USERNAME = "local-admin"
$env:ADMIN_PASSWORD = "仅用于本地隔离测试的密码"
node tests/e2e.integration.mjs
```

Linux/macOS：

```bash
export E2E_BASE_URL="http://localhost:3000"
export ADMIN_ROUTE="admin"
export ADMIN_USERNAME="local-admin"
export ADMIN_PASSWORD="仅用于本地隔离测试的密码"
node tests/e2e.integration.mjs
```

不要让端到端测试连接生产数据库、真实客户资料或生产短信配置。Chrome DevTools MCP 的网页验收步骤、真实资料基准和自动化映射见 [`tests/ACCEPTANCE.md`](tests/ACCEPTANCE.md)。

## 生产部署

生产环境采用以下边界。下面的绝对路径均属于远端 Debian 服务器，与执行部署操作的本机系统无关：

- nginx 对外提供 80/443，HTTP 跳转 HTTPS。
- 应用只监听 `127.0.0.1:3100`，不直接暴露 Node.js 端口。
- systemd 管理应用、归档 timer 和备份 timer。
- SQLite 与业务文件位于 `/var/lib/prep-trove`，独立于代码 release。
- release 位于 `/opt/prep-trove/releases/<timestamp>`，`current` 通过原子软链接切换。
- 健康检查失败时恢复上一个 release。
- SSH 可用时优先使用 SCP 一次上传精简发布包；阿里云云助手分块上传作为回退通道。

完整的服务器初始化、nginx、HTTPS、systemd、备份、发布、回滚和故障检查步骤见 [`deploy/DEPLOY.md`](deploy/DEPLOY.md)。

## 生产管理后台

生产环境不会在固定 `/admin` 暴露后台；该路径按设计返回 404。首次安装会生成：

- 高熵管理路径。
- 非默认管理员用户名。
- 强随机管理员密码及 PBKDF2 摘要。

实际管理 URL、用户名和密码只允许通过服务器 root-only 凭据文件交付，并应保存到可信密码管理器。不要把真实管理路径、账号或密码写入仓库、聊天、工单、截图或普通文档。

管理路径、用户名和密码首次初始化后保持固定。正常发布不得删除或覆盖 `/etc/prep-trove.env`，部署前后应核对管理配置指纹。访问方式和防误变更规则见部署手册中的“访问生产管理后台”和“固定凭据防误变更”。

## 数据安全与隐私

- 管理员密码、阿里云密钥、应用密钥和签名密钥只存环境变量或密钥管理系统。
- 不记录明文验证码、会话令牌、商品链接令牌、完整手机号或订单号。
- 商品链接令牌在数据库中同时保存服务端可解密密文和不可逆摘要，不保存明文。
- 生产环境中的管理员与买家会话 Cookie 均使用 `HttpOnly` 和 `Secure`；管理员会话采用 `SameSite=Strict`，买家会话采用 `SameSite=Lax`。
- 原始 PDF、买家生成文件、SQLite、备份和 `old-sold` 均位于非公开目录。
- `.gitignore` 排除 `.env`、PEM、PDF、ZIP、数据库数据、缓存和生成物。
- 服务器本地备份仍与业务数据位于同一磁盘，生产环境还应启用阿里云自动快照或异地备份。

## 项目文档

- [`SPEC.md`](SPEC.md)：权威产品与工程规格。
- [`docs/incidents/2026-08-04-xiaohongshu-webview-chrome92.md`](docs/incidents/2026-08-04-xiaohongshu-webview-chrome92.md)：小红书 Chrome 92 WebView 兼容故障的证据链、修复和复用排查手册。
- [`marketing/README.md`](marketing/README.md)：商品营销素材结构与连续竖图生成方法。
- [`tests/ACCEPTANCE.md`](tests/ACCEPTANCE.md)：端到端 testcase、真实资料基准和生产验收记录。
- [`deploy/DEPLOY.md`](deploy/DEPLOY.md)：阿里云部署、HTTPS、后台访问、固定凭据、备份和回滚。

## 当前范围外

- 多管理员、角色权限、管理员注册和找回密码。
- 在线支付、订单平台 API 自动验单和退款。
- CDN、对象存储、跨区域高可用和多实例生成队列。
- Cloudflare Workers、D1、R2 与 Serverless 部署。
