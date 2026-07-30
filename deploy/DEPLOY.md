# 阿里云轻量服务器部署手册

> 本文档由 AI 辅助整理，并由项目负责人审核。

## 命令与路径约定

- 本机命令默认从仓库根目录执行。Windows 使用 PowerShell 或文中明确指定的 Git Bash；Linux/macOS 使用 Bash 或兼容的 POSIX shell。
- 本机路径语法不同时，文档分别给出 Windows PowerShell 与 Linux/macOS 版本。
- `/etc`、`/var`、`/opt`、`/root`、`/tmp` 下的路径以及 `systemctl`、`journalctl`、`chown`、`chmod`、`certbot` 命令都属于远端 Debian 服务器。无论运维人员的本机是 Windows、Linux 还是 macOS，这些远端命令和路径都保持不变。

## 目标架构

| 项目 | 配置 |
| --- | --- |
| 轻量服务器 | `c3c514211070460cb094dde74fbeadb9`，`cn-shanghai`，Debian 12 |
| 域名 | `bzzl.ysspark.cn` |
| nginx | 公网 80/443，反向代理至 `127.0.0.1:3100` |
| 应用 | Node.js 24+、Next.js、systemd |
| 数据库 | `/var/lib/prep-trove/db/prep-trove.sqlite3`，SQLite WAL |
| 私有文件 | `/var/lib/prep-trove/files` |
| 发布目录 | `/opt/prep-trove/releases/<timestamp>`，`current` 为当前版本软链接 |
| 环境变量 | `/etc/prep-trove.env`，权限 `0600` |

现有 `ysspark.cn`、`knowmefun.cn` 和 8000 端口上的 `di_backend` 不得修改。本应用固定使用 3100 端口。

## 首次部署前

1. 将 `bzzl.ysspark.cn` 的 A 记录指向轻量服务器公网 IP。
2. 在本机确认 `aliyun sts GetCallerIdentity` 和 SWAS 插件可用。
3. 准备至少 32 个随机字符的 `APP_SECRET` 和阿里云短信生产配置。

如果 `/etc/prep-trove.env` 尚不存在，首次安装会在服务器内部复用现有 DI 服务的阿里云短信变量并生成独立 `APP_SECRET`。安装脚本会生成高熵管理入口、非默认账号和 48 位十六进制强随机密码，密码只以 PBKDF2 摘要写入环境文件。首次凭据写入 `/root/prep-trove-admin-credentials.txt`（权限 `0600`）；安全保存后应删除该明文文件。

服务器环境文件格式如下，禁止提交真实值：

```dotenv
ADMIN_ROUTE=manage-replace-with-48-lowercase-hex-characters
ADMIN_USERNAME=operator_replace-with-16-lowercase-hex-characters
ADMIN_PASSWORD_HASH=replace-with-generated-hash
APP_SECRET=replace-with-random-secret
APP_DATA_DIR=/var/lib/prep-trove
ENVIRONMENT=production
SMS_MODE=aliyun
ALIBABA_CLOUD_SMS_ACCESS_KEY_ID=replace-me
ALIBABA_CLOUD_SMS_ACCESS_KEY_SECRET=replace-me
SMS_SIGN_NAME=replace-me
SMS_TEMPLATE_CODE=replace-me
SMS_TEMPLATE_VARIABLE=code
SMS_REGION_ID=cn-hangzhou
```

使用云助手将该文件写入 `/etc/prep-trove.env`，随后在远端 Debian 服务器执行：

```bash
chown root:prep-trove /etc/prep-trove.env
chmod 0640 /etc/prep-trove.env
```

## 发布应用

在仓库根目录执行。Windows 使用 Git Bash，Linux/macOS 使用 Bash；三个平台的命令相同：

```bash
bash deploy/deploy.sh
```

脚本只发布已经提交且已推送到 `origin/main` 的 Git `HEAD`。存在未提交的已跟踪文件，或本地 `HEAD` 与 `origin/main` 不一致时，脚本会在打包前停止。发布包由 `git archive` 生成，并显式拒绝密钥、缓存、PDF、ZIP、业务资料和历史目录，避免本地工作目录中的忽略文件进入服务器。

默认 `DEPLOY_TRANSPORT=auto`：项目内 `.secrets/aliyun/ptedi.pem` 可用且本机安装了 `ssh`、`scp` 时，脚本优先通过 SCP 一次上传完整压缩包；否则回退到阿里云云助手分块通道。需要显式选择时，可在 Git Bash 中运行 `DEPLOY_TRANSPORT=scp bash deploy/deploy.sh` 或 `DEPLOY_TRANSPORT=swas bash deploy/deploy.sh`。云助手发布包默认不得超过 2 MiB，超过时脚本会在上传前停止并提示使用 SCP，避免异常包产生数小时的无效分块上传。云助手分块默认使用 11,000 字节；加入 Shell 包装并经过 Base64 编码后仍低于 [`RunCommand` 官方规定的 16 KiB 上限](https://help.aliyun.com/zh/simple-application-server/developer-reference/api-swas-open-2020-06-01-runcommand/)。

SCP 与云助手通道都会从发布包中提取并执行同一份 `deploy/remote-release.sh`。服务器统一校验或下载固定 SHA-256 的公开 OG 图片和中文 WOFF2 字体，使用 `woff2_decompress` 生成水印所需的 PDF 兼容 TTF，然后运行 `npm ci` 和 `npm run build`。systemd 通过健康检查后原子切换 `current`；健康检查失败时自动恢复上一个版本。发布成功后自动清理旧 release，只保留最近 6 个合法时间戳目录，并始终保护 `current`。

服务器安装步骤会统一把 `deploy/*.sh` 恢复为 `0755`，用于兼容 Windows 打包时丢失 Unix 可执行位的情况。部署完成后必须确认备份服务实际运行成功，不能只依赖应用健康检查。

如果 SCP 连接临时不可用，可以显式设置 `DEPLOY_TRANSPORT=swas` 使用云助手回退通道。不要手工打包整个工作目录；统一通过 `deploy/deploy.sh` 创建受控发布包并调用远端发布流程。

## nginx 与证书

首次签证书前先安装 `deploy/nginx/bzzl.ysspark.cn.http.conf`，执行 `nginx -t` 后 reload。随后在远端 Debian 服务器运行：

```bash
certbot certonly --webroot -w /var/www/bzzl.ysspark.cn -d bzzl.ysspark.cn --non-interactive --agree-tos -m service@ysspark.cn
```

证书签发成功后将 `deploy/nginx/bzzl.ysspark.cn.conf` 安装到 `/etc/nginx/conf.d/bzzl.ysspark.cn.conf`，再次执行 `nginx -t` 和 reload。

## 日常运维

以下命令通过 SSH 登录后在远端 Debian 服务器执行：

```bash
systemctl status prep-trove.service
journalctl -u prep-trove.service --since '1 hour ago'
systemctl list-timers 'prep-trove-*'
curl --fail http://127.0.0.1:3100/api/health
```

归档任务每天按 `Asia/Shanghai` 02:00 执行，数据库在线备份每天 03:00 执行并保留 14 天。服务器本地备份仍与业务数据位于同一块磁盘，必须同时启用阿里云轻量服务器自动快照或将备份同步到另一存储位置。

## 访问生产管理后台

生产管理入口、账号和密码均由首次安装随机生成。固定 `/admin` 按设计返回 404，不用于生产登录。

在项目根目录执行以下对应命令。

Windows PowerShell：

```powershell
ssh -i ".\.secrets\aliyun\ptedi.pem" root@47.116.99.82 "cat /root/prep-trove-admin-credentials.txt"
```

Linux/macOS：

```bash
ssh -i "./.secrets/aliyun/ptedi.pem" root@47.116.99.82 "cat /root/prep-trove-admin-credentials.txt"
```

root-only 凭据文件返回以下三项：

```text
ADMIN_URL=...
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
```

在浏览器打开 `ADMIN_URL`，使用对应账号和密码登录。实际管理路径、账号和密码不得写入代码仓、聊天、邮件、截图或普通文档。将凭据保存到可信密码管理器并确认可恢复后，应删除服务器上的明文凭据文件；生产环境只在 `/etc/prep-trove.env` 保留管理路径、账号和密码摘要。

项目内 PEM 副本位于 `.secrets/aliyun/ptedi.pem`，整个 `.secrets/` 目录必须保持 Git 忽略状态。

### 固定凭据防误变更

生产管理路径、用户名和密码在首次初始化后保持固定。应用运行时以 `/etc/prep-trove.env` 为唯一配置来源；`/root/prep-trove-admin-credentials.txt` 只用于首次交付明文凭据，不会反向更新应用配置。

`/etc/prep-trove.env` 是 systemd `EnvironmentFile`，其中的密码摘要可能包含 `$`。不得使用 `. /etc/prep-trove.env` 或 `source /etc/prep-trove.env` 将整份文件当作 Shell 脚本执行；Shell 会展开摘要中的 `$`，可能导致报错或传入错误值。一次性维护命令应通过 systemd 启动应用，或只显式传入该命令实际需要的非敏感变量。

日常发布必须遵守以下规则：

1. 不得删除、覆盖或用仓库中的 `.env.example` 替换 `/etc/prep-trove.env`。
2. 不得删除或单独修改 `ADMIN_ROUTE`、`ADMIN_USERNAME`、`ADMIN_PASSWORD_HASH`。三项需要人工轮换时必须作为同一次受控变更处理，并同步更新密码管理器。
3. `ADMIN_ROUTE` 必须保持 `manage-` 加 48 位小写十六进制字符；`ADMIN_USERNAME` 不得改回 `admin`。安装脚本发现管理路径缺失/格式无效，或用户名为 `admin` 时，会将三项重新初始化。
4. 正常发布前后都要核对管理配置指纹。指纹一致表示三项没有发生变化；以下命令在远端 Debian 服务器执行，只输出摘要，不显示实际凭据：

   ```bash
   grep -E '^(ADMIN_ROUTE|ADMIN_USERNAME|ADMIN_PASSWORD_HASH)=' /etc/prep-trove.env | sort | sha256sum
   ```

5. 首次确认凭据可登录后，将实际 URL、用户名和密码保存到可信密码管理器。删除 `/root/prep-trove-admin-credentials.txt` 不会改变运行中的凭据；删除前必须确认密码管理器中的记录可以恢复。
6. 修改 `/etc/prep-trove.env` 前先在远端 Debian 服务器创建 root-only 备份，并确认备份权限：

   ```bash
   backup="/root/prep-trove.env.$(date -u +%Y%m%dT%H%M%SZ).backup"
   install -o root -g root -m 0600 /etc/prep-trove.env "$backup"
   stat -c '%a %U:%G %n' "$backup"
   ```

7. 部署后验证固定 `/admin` 仍返回 404、密码管理器中的 `ADMIN_URL` 返回管理登录页，并完成一次登录与退出。不得在命令日志、工单、聊天或截图中打印实际凭据。

如果部署前后管理配置指纹不同，应停止继续操作，保持管理入口不对外传播，检查 `/etc/prep-trove.env` 的变更时间、发布日志和安装脚本输出；确认原因并恢复受控备份后再重启应用。

## 回滚

在远端 Debian 服务器列出 `/opt/prep-trove/releases`，将 `/opt/prep-trove/current` 指向上一个完整版本，再重启服务。数据目录独立于代码版本，回滚代码不会覆盖 SQLite 和资料文件。涉及数据库结构变更时必须先阅读对应迁移说明。
