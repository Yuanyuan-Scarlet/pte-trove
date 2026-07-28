# 小圆 PTE 突击宝藏资料系统

一个完整的资料发布和自动交付应用。管理员上传 WFD、DI、SST、RS、WE 五个 PDF 并发布，系统生成六个独立链接；买家通过中国大陆手机号、短信验证码和小红书订单号生成逐页带手机号水印的 PDF 或五项合集 ZIP。

业务规则以 [`SPEC.md`](SPEC.md) 为准。

## 技术结构

- Vinext、React 和 TypeScript：买家端与管理员后台。
- Cloudflare D1：版本、链接、绑定、验证码、会话和生成记录。
- Cloudflare R2：原始 PDF、专属文件、历史资料和 `old-sold`。
- `pdf-lib`、Fontkit 和 Noto Sans SC：中文逐页水印。
- 阿里云短信 SendSms API：生产验证码。

## 本地运行

需要 Node.js 22.13，或 Node.js 24 以上；仓库的 `.nvmrc` 使用 Node 26.3.0。

```powershell
npm install
npm run dev
```

打开 `http://localhost:3000/admin`。本地 `.dev.vars` 使用模拟短信；管理员账号为 `admin`，本地密码为 `admin12345`。这些开发凭据不会提交到 Git，部署前必须配置生产凭据。

## 验证命令

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run db:generate
```

端到端测试需要本地服务和 `.tmp/e2e-source.pdf`：

```powershell
node tests/e2e.integration.mjs
```

## 生产配置

复制 `.env.example` 中的变量到托管平台。必须配置：

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`
- `APP_SECRET`
- `ALIBABA_CLOUD_SMS_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_SMS_ACCESS_KEY_SECRET`
- `SMS_SIGN_NAME`
- `SMS_TEMPLATE_CODE`

运行 `npm run admin:hash` 生成 `ADMIN_PASSWORD_HASH`。生产环境设置 `ENVIRONMENT=production`、`SMS_MODE=aliyun`，并将 `APP_SECRET` 设置为至少 32 位随机字符串。

部署需要一个 D1 绑定 `DB` 和一个 R2 绑定 `FILES`。应用包含每日归档的 Worker `scheduled` 处理器；托管环境应配置每日 Cron Trigger。建议在中国标准时间凌晨 02:00 执行，对应 UTC `0 18 * * *`。

## 安全说明

原始资料、生成文件和 `old-sold` 都只能通过 R2 私有绑定访问。不要提交真实 PDF、手机号、订单号、验证码或密钥。生产部署前需替换全部开发配置，并确认阿里云短信模板已生效。
