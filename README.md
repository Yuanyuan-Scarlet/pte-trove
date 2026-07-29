# 小圆 PTE 突击宝藏资料系统

> 本文档由 AI 辅助整理，并由项目负责人审核。

管理员上传 WFD、DI、SST、RS、WE 五个 PDF 并发布后，系统生成六个独立入口；买家通过中国大陆手机号、阿里云短信验证码和小红书订单号生成逐页带手机号水印的 PDF 或五项合集 ZIP。

业务规则以 [`SPEC.md`](SPEC.md) 为准。

## 技术结构

- Next.js、React 和 TypeScript：买家端、管理员后台和服务端 API。
- Node.js：部署在阿里云轻量应用服务器，由 systemd 管理。
- SQLite（WAL）：保存版本、链接、绑定、验证码、会话和生成记录。
- 服务器私有磁盘：保存原始 PDF、专属文件、历史资料和 `old-sold`。
- nginx：为 `bzzl.ysspark.cn` 提供 HTTPS、上传限制和反向代理。
- systemd timer：执行每日归档和 SQLite 在线备份。
- `pdf-lib`、Fontkit 和 Noto Sans SC：中文逐页水印。
- 阿里云短信 SendSms API：生产验证码。

本项目不依赖 Cloudflare Workers、D1、R2、Wrangler 或 Serverless 运行时。

## 本地运行

使用 Node.js 22.13 或 Node.js 24 以上；`.nvmrc` 指定 Node 26.3.0。

```powershell
npm install
npm run dev
```

默认数据保存在项目私有目录 `.data/`。开发环境默认管理入口为 `http://localhost:3000/admin`；生产入口由高熵 `ADMIN_ROUTE` 决定，不使用固定 `/admin`。

原始资料上传上限：DI 为 100MiB，WFD、SST、RS、WE 各为 50MiB。

## 验证命令

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run db:generate
```

生产构建会将完整 `public/` 和 `.next/static/` 复制到 `.next/standalone/`，`npm run start` 直接运行 standalone server。

端到端测试需要本地服务和 `.tmp/e2e-source.pdf`：

```powershell
node tests/e2e.integration.mjs
```

Chrome DevTools 网页验收步骤、真实资料基准和自动化映射见 [`tests/ACCEPTANCE.md`](tests/ACCEPTANCE.md)。

## 生产配置

生产环境在 `/etc/prep-trove.env` 配置以下变量：

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_ROUTE`
- `APP_SECRET`
- `APP_DATA_DIR=/var/lib/prep-trove`
- `ALIBABA_CLOUD_SMS_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_SMS_ACCESS_KEY_SECRET`
- `SMS_SIGN_NAME`
- `SMS_TEMPLATE_CODE`
- `ENVIRONMENT=production`
- `SMS_MODE=aliyun`

运行 `npm run admin:hash` 生成管理员密码摘要。生产环境必须使用不可预测的管理路径、非默认账号和强随机密码；生产密钥、PDF、SQLite 数据库和买家生成文件不得提交到 Git。

## 阿里云部署

服务器配置、nginx、systemd、发布、证书和备份流程见 [`deploy/DEPLOY.md`](deploy/DEPLOY.md)。应用只监听 `127.0.0.1:3100`，业务数据固定存放在发布目录之外的 `/var/lib/prep-trove`，版本切换不会覆盖数据。

生产后台不使用固定 `/admin`。管理人员应按照部署手册中的“访问生产管理后台”章节，通过 SSH 从服务器 root-only 凭据文件读取实际管理 URL、账号和密码。

管理路径、账号和密码首次初始化后保持固定。发布前后的防误变更检查、配置指纹和备份要求见部署手册中的“固定凭据防误变更”。
