# Love Free Tools - 公益平台

一个基于 Cloudflare Workers 和 Node.js 的免费公益服务平台，提供临时邮箱、短链接生成、GitHub 代理、文件加速下载等功能，集成 AI 智能分析能力。

## 在线演示

### 服务入口

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端主页 | https://free.violetteam.cloud | 临时邮箱服务主页面 |
| 文件加速 | https://download.qxfy.store/proxy/?url={URL} | 文件下载加速 |

### 多域名支持

本平台支持多个域名，每个域名都提供完整的服务功能。你可以使用任意域名进行以下操作：

| 功能 | 使用方式 | 示例 |
|------|----------|------|
| 临时邮箱 | 在前端选择域名生成邮箱 | user@{domain} |
| API 文档 | 访问域名根路径 | https://{domain}/ |
| GitHub 代理 | 域名后接仓库路径 | https://{domain}/{user}/{repo} |
| 文件加速 | 使用 proxy 路径 | https://{domain}/proxy/?url={URL} |
| 短链接 | 使用 /s/ 路径 | https://{domain}/s/{code} |
| 免费子域名 | 申请子域名 | xxx.lovefreetools.site |
| HTTP 代理 | 配置代理地址 | 115.190.229.8:8888 |

当前可用域名：

| 域名 | 状态 |
|------|------|
| logincursor.xyz | 可用 |
| kami666.xyz | 可用 |
| deploytools.site | 可用 |
| loginvipcursor.icu | 可用 |
| qxfy.store | 可用 |
| violetteam.cloud | 可用 |

所有域名共享同一后端数据库，邮件和短链接数据在所有域名间互通。

## 目录

- [在线演示](#在线演示)
- [功能特性](#功能特性)
- [系统架构](#系统架构)
- [部署指南](#部署指南)
- [Cloudflare Git 同步部署](#cloudflare-git-同步部署)
- [API 文档](#api-文档)
- [配置说明](#配置说明)
- [文件结构](#文件结构)
- [技术栈](#技术栈)
- [安全说明](#安全说明)
- [许可证](#许可证)

## 功能特性

### 1. 临时邮箱服务

- **多域名支持**：支持多个域名自由切换
- **邮箱生成**：随机生成或自定义邮箱前缀
- **自动刷新**：每 5 秒自动检查新邮件
- **邮件查看**：支持纯文本和 HTML 两种视图模式
- **验证码提取**：智能识别并高亮显示验证码
- **一键复制**：快速复制邮箱地址或验证码
- **历史记录**：本地保存使用过的邮箱地址
- **邮件发送**：支持通过平台发送邮件

### 2. AI 智能分析

基于 Cloudflare Workers AI 和 ModelScope API（备用）实现：

- **验证码提取**：自动从邮件中识别并提取 4-8 位验证码
- **邮件摘要**：生成中英双语邮件摘要，支持一键切换
- **垃圾邮件检测**：智能判断邮件是否为垃圾邮件或钓鱼邮件
- **语言检测**：自动识别邮件语言（中文、英文、日文等）
- **内容翻译**：一键将邮件内容翻译为中文
- **链接安全检测**：分析短链接目标 URL 的安全性

AI 模型配置：
- 主用：Cloudflare Workers AI（@cf/meta/llama-3-8b-instruct）
- 备用：ModelScope API（deepseek-ai/DeepSeek-V3.2）

### 3. 短链接服务

- **链接缩短**：将长 URL 转换为短链接
- **自定义代码**：支持自定义短链接后缀
- **点击统计**：记录短链接访问次数
- **过期时间**：可设置链接有效期
- **安全检测**：AI 分析目标链接安全性

### 4. GitHub 代理加速

- **仓库克隆**：加速 git clone 操作
- **文件下载**：加速 Raw 文件下载
- **Release 下载**：加速 GitHub Release 资源下载
- **请求限制**：每 IP 每分钟最多 60 次请求
- **路径过滤**：禁止访问登录、设置等敏感路径

### 5. 文件加速下载

- **通用代理**：支持任意 HTTPS 文件加速下载
- **断点续传**：支持 Range 请求
- **无大小限制**：不限制文件大小
- **自动重定向**：自动跟随 HTTP 重定向
- **保留文件名**：保持原始文件名

### 6. 免费子域名服务

为用户提供免费的子域名解析服务：

- **可用域名**：`lovefreetools.site`、`violet27team.xyz`
- **支持记录类型**：A、AAAA、CNAME、MX、TXT、REDIRECT
- **Cloudflare 代理**：A/AAAA/CNAME 记录可开启 Cloudflare CDN 加速
- **用户密钥管理**：每条记录绑定用户密钥，自主管理删除
- **实时 DNS**：通过 Cloudflare API 创建真实 DNS 记录

使用方式：
1. 在前端点击"申请子域名"
2. 输入子域名、选择域名、配置记录类型和值
3. 设置管理密钥（用于后续删除）
4. 点击添加记录

### 7. 免费 HTTP 代理

为爬虫和自动化工具提供免费的国内 HTTP 代理服务：

- **代理地址**：`115.190.229.8:8888`
- **协议支持**：HTTP/HTTPS
- **无需认证**：开放访问，无需账号密码
- **国内节点**：适合访问需要国内 IP 的网站
- **使用限制**：带宽 1Mbps，建议并发数 5 以内

支持多种编程语言和工具：

| 工具/语言 | 使用方式 |
|-----------|----------|
| Python | `requests.get(url, proxies={"http": "http://115.190.229.8:8888"})` |
| cURL | `curl -x http://115.190.229.8:8888 http://example.com` |
| CMD | `set HTTP_PROXY=http://115.190.229.8:8888` |
| PowerShell | `$env:HTTP_PROXY = "http://115.190.229.8:8888"` |
| Node.js | 使用 `https-proxy-agent` 库 |
| Java | 使用 `java.net.Proxy` 类 |
| Go | 使用 `http.Transport` 配置代理 |

## 系统架构

```
                                    +------------------+
                                    |   Cloudflare     |
                                    |   Workers AI     |
                                    +--------+---------+
                                             |
+-------------+     +------------------+     |     +------------------+
|   Browser   | --> | Cloudflare Worker| ----+---> | ModelScope API   |
|  Frontend   |     | (Email Handler)  |           | (Fallback)       |
+-------------+     +--------+---------+           +------------------+
                             |
                             v
                    +------------------+
                    |  Node.js Backend |
                    |  (Express API)   |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |     MySQL        |
                    |    Database      |
                    +------------------+
```

### 组件说明

| 组件 | 说明 |
|------|------|
| Cloudflare Worker | 处理邮件接收、API 路由、GitHub 代理、文件加速 |
| Node.js Backend | RESTful API 服务，处理数据存储和业务逻辑 |
| MySQL Database | 存储邮件、短链接、域名等数据 |
| Cloudflare Workers AI | 主 AI 服务，处理邮件分析 |
| ModelScope API | 备用 AI 服务，Cloudflare AI 失败时自动切换 |

## 部署指南

### 前置要求

- Cloudflare 账户（免费版即可）
- 一台服务器（运行 Node.js 后端）
- MySQL 数据库
- 域名（已托管在 Cloudflare）

### 步骤 1：配置数据库

```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE free_email CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 导入表结构
USE free_email;
SOURCE server/database.sql;

# 添加 AI 字段（如果是升级）
SOURCE server/database-upgrade-ai.sql;

# 添加短链接表
SOURCE server/create-short-links-table.sql;
```

### 步骤 2：部署后端服务

```bash
# 进入服务器目录
cd server

# 安装依赖
npm install

# 配置环境变量
cp env.example.txt .env
# 编辑 .env 文件，填写数据库连接信息和 Resend API Key

# 启动服务
pm2 start index.js --name free-email-api

# 设置开机自启
pm2 save
pm2 startup
```

环境变量说明：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| DB_HOST | 数据库主机 | localhost |
| DB_USER | 数据库用户 | root |
| DB_PASSWORD | 数据库密码 | your_password |
| DB_NAME | 数据库名 | free_email |
| RESEND_API_KEY | Resend 邮件发送 API Key | re_xxx |
| ADMIN_KEY | 管理员密钥 | your_admin_key |
| CF_DNS_API_TOKEN | Cloudflare DNS API Token | xxx |
| CF_ZONE_LOVEFREETOOLS | lovefreetools.site Zone ID | xxx |
| CF_ZONE_VIOLET27TEAM | violet27team.xyz Zone ID | xxx |

### 步骤 3：配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 步骤 4：部署 Cloudflare Worker

1. 登录 Cloudflare Dashboard
2. 进入 Workers & Pages，创建新 Worker
3. 将 `server/workers-mysql.js` 内容粘贴到编辑器
4. 配置环境变量：
   - `API_BASE`: 后端 API 地址（如 https://api.yourdomain.com）
   - `ADMIN_KEY`: 管理员密钥
   - `MODELSCOPE_KEY`: ModelScope API Key（可选）
5. 绑定 AI：Settings -> Variables -> AI Bindings，添加名为 `AI` 的绑定
6. 配置自定义域名或 Worker 路由

### 步骤 5：配置 Email Routing

1. 进入 Cloudflare Dashboard -> 域名 -> Email -> Email Routing
2. 配置 Catch-all 规则：Send to Worker，选择你的 Worker
3. 确保 DNS 中有正确的 MX 记录

### 步骤 6：部署前端

**方式 A：Cloudflare Pages**

1. 将代码推送到 GitHub
2. 在 Cloudflare Pages 中连接仓库
3. 构建设置：构建命令留空，输出目录设为 `/`

**方式 B：静态文件托管**

将以下文件上传到任意静态托管服务：
- index.html
- css/
- js/
- favicon.svg
- privacy.html
- terms.html

## Cloudflare Git 同步部署

通过将 Cloudflare Worker 连接到 Git 仓库，可以实现代码推送后自动构建和部署，无需手动复制粘贴代码。

### 前置要求

- GitHub 仓库（本项目已托管在 https://github.com/violettoolssite/loveFreeTools）
- Cloudflare 账户
- 已有的 Worker（或新建一个）

### 步骤 1：进入 Worker 设置

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages**
3. 点击你的 Worker（如 `login`）
4. 进入 **Settings** 选项卡
5. 找到 **Build** 部分，点击 **Connect to Git**

### 步骤 2：连接 Git 仓库

1. 选择 **GitHub** 作为 Git 提供商
2. 点击 **Connect GitHub**，授权 Cloudflare 访问你的 GitHub 账户
3. 选择仓库：`violettoolssite/loveFreeTools`
4. 点击 **Begin Setup**

### 步骤 3：配置构建设置

在构建配置页面，设置以下参数：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 构建命令 | 留空 | 本项目无需构建步骤 |
| 部署命令 | `npx wrangler deploy` | 使用 Wrangler CLI 部署 |
| 版本命令 | `npx wrangler versions upload` | 上传版本信息 |
| 根目录 | `/` | 项目根目录 |
| 生产分支 | `main` | 主分支 |
| 非生产分支构建 | 已启用 | 其他分支也会触发构建 |

### 步骤 4：配置构建监视路径

设置哪些文件变更会触发重新构建：

- **包括路径**: `*`（监视所有文件）
- 或者只监视 Worker 相关文件：`server/workers-mysql.js`, `wrangler.toml`

### 步骤 5：配置 API 令牌

Cloudflare 会自动创建一个 API 令牌用于部署：

- **令牌名称**: 自动生成（如 `loveFreeTools build token`）
- 该令牌具有部署 Worker 所需的最小权限

### 步骤 6：保存并测试

1. 点击 **Save and Deploy**
2. Cloudflare 会立即触发第一次构建
3. 查看构建日志确认部署成功

### 验证部署

构建完成后，检查以下内容：

1. **Worker 代码**：进入 Worker 编辑器，确认代码已更新
2. **环境变量**：确保 `API_BASE`、`ADMIN_KEY` 等变量已配置
3. **AI 绑定**：确保 `AI` 绑定已添加
4. **功能测试**：访问 Worker 域名，测试 API 是否正常

### wrangler.toml 配置说明

项目根目录的 `wrangler.toml` 文件定义了 Worker 配置：

```toml
name = "login"                    # Worker 名称
main = "server/workers-mysql.js"  # 入口文件路径
compatibility_date = "2024-01-01" # 兼容性日期
```

重要说明：
- `name` 必须与 Cloudflare Dashboard 中的 Worker 名称一致
- `main` 指向 Worker 入口文件
- 环境变量和绑定需要在 Dashboard 中配置，不在此文件中设置

### 后续更新流程

配置完成后，每次推送代码到 GitHub 会自动触发部署：

```bash
# 修改代码后
git add .
git commit -m "Update feature"
git push origin main

# Cloudflare 会自动：
# 1. 检测到新提交
# 2. 执行 npx wrangler deploy
# 3. 部署新版本到 Worker
```

### 查看构建历史

1. 进入 Worker -> Settings -> Build
2. 点击 **View build history**
3. 可以查看每次构建的日志、状态和持续时间

### 回滚版本

如果新版本有问题，可以快速回滚：

1. 进入 Worker -> Deployments
2. 找到之前的正常版本
3. 点击 **Rollback to this version**

### 常见问题

**Q: 构建失败，提示找不到 wrangler**

A: 确保项目根目录有 `wrangler.toml` 文件，Cloudflare 会自动安装 wrangler。

**Q: 部署成功但功能不正常**

A: 检查环境变量是否配置正确，特别是 `API_BASE` 和 `ADMIN_KEY`。

**Q: 如何暂停自动部署**

A: 进入 Worker -> Settings -> Build，点击 **Pause builds**。

**Q: 如何断开 Git 连接**

A: 进入 Worker -> Settings -> Build，点击 **Disconnect from Git**。

## API 文档

### 邮件 API

#### 获取邮件列表

```
GET /api/emails/:email
```

参数：
- `email`: 邮箱地址（URL 编码）
- `hideSpam`: 可选，设为 `true` 过滤垃圾邮件

返回：
```json
{
  "email": "test@example.com",
  "count": 5,
  "success": true,
  "emails": [
    {
      "id": 1,
      "from": "sender@example.com",
      "to": "test@example.com",
      "subject": "Test Email",
      "text": "Email content",
      "html": "<p>Email content</p>",
      "date": "2025-01-01T00:00:00.000Z",
      "verificationCode": "123456",
      "summary": "Test email summary",
      "isSpam": false,
      "language": "zh"
    }
  ]
}
```

#### 删除邮件

```
DELETE /api/emails/:email/:id
```

### 短链接 API

#### 创建短链接

```
POST /api/links
```

请求体：
```json
{
  "url": "https://example.com/very-long-url",
  "code": "custom",
  "expiresIn": 7
}
```

#### 获取短链接信息

```
GET /api/links/:code
```

#### 短链接跳转

```
GET /s/:code
```

### AI API

#### 翻译

```
POST /api/ai/translate
Content-Type: application/json

{
  "text": "Hello, world!",
  "targetLang": "zh"
}
```

#### 生成摘要

```
POST /api/ai/summarize
Content-Type: application/json

{
  "text": "Email content here...",
  "subject": "Email subject"
}
```

#### 提取验证码

```
POST /api/ai/extract-code
Content-Type: application/json

{
  "text": "Your verification code is 123456",
  "subject": "Verification"
}
```

#### URL 安全检测

```
POST /api/ai/check-url
Content-Type: application/json

{
  "url": "https://example.com"
}
```

### 域名管理 API

需要管理员密钥（通过 X-Admin-Key 请求头传递）

#### 获取域名列表

```
GET /api/domains
```

#### 添加域名

```
POST /api/domains
X-Admin-Key: your_admin_key
Content-Type: application/json

{
  "name": "example.com",
  "api": "https://api.example.com"
}
```

#### 删除域名

```
DELETE /api/domains/:name
X-Admin-Key: your_admin_key
```

### 发送邮件 API

```
POST /api/send-email
Content-Type: application/json

{
  "from": "sender@yourdomain.com",
  "to": "recipient@example.com",
  "subject": "Test Email",
  "text": "Plain text content",
  "html": "<p>HTML content</p>"
}
```

## 配置说明

### Worker 环境变量

| 变量名 | 必需 | 说明 |
|--------|------|------|
| API_BASE | 是 | 后端 API 地址 |
| ADMIN_KEY | 是 | 管理员密钥 |
| MODELSCOPE_KEY | 否 | ModelScope API Key（AI 备用） |
| AI_ENABLED | 否 | AI 功能开关（默认 true） |

### Worker 绑定

| 绑定名称 | 类型 | 说明 |
|----------|------|------|
| AI | Workers AI | AI 模型绑定 |
| EMAILS_KV | KV Namespace | 可选，用于缓存 |

## 文件结构

```
loveFreeTools/
├── index.html                    # 前端主页面
├── privacy.html                  # 隐私政策页面
├── terms.html                    # 服务条款页面
├── favicon.svg                   # 网站图标
├── _headers                      # Cloudflare Pages HTTP 头配置
├── _redirects                    # Cloudflare Pages 重定向规则
├── README.md                     # 项目说明文档
│
├── css/
│   └── style.css                 # 样式文件
│
├── js/
│   ├── app.js                    # 主应用逻辑
│   ├── api.js                    # API 请求封装
│   └── utils.js                  # 工具函数
│
├── server/
│   ├── index.js                  # Node.js 后端主程序
│   ├── workers-mysql.js          # Cloudflare Worker 代码
│   ├── cloudflare-dns.js         # Cloudflare DNS API 模块
│   ├── database.sql              # MySQL 数据库结构
│   ├── database-upgrade-ai.sql   # AI 字段升级脚本
│   ├── create-short-links-table.sql  # 短链接表创建脚本
│   ├── create-dns-records-table.sql  # DNS 记录表创建脚本
│   ├── package.json              # Node.js 依赖配置
│   ├── env.example.txt           # 环境变量示例
│   ├── update-server.sh          # 服务器更新脚本
│   └── DEPLOY.md                 # 部署文档
│
├── workers-download.js           # 文件下载代理 Worker
├── wrangler.toml                 # Wrangler CLI 配置
├── .gitignore                    # Git 忽略文件
│
└── proxy-server/
    ├── install-tinyproxy.sh      # TinyProxy 安装脚本
    ├── test_proxy.py             # 代理测试脚本
    └── README.md                 # 代理服务部署文档
```

## 技术栈

### 前端

- HTML5 + CSS3 + Vanilla JavaScript
- 深色赛博朋克主题设计
- 响应式布局，支持移动端
- 字体：JetBrains Mono + Noto Sans SC

### 后端

- Node.js + Express.js
- MySQL 数据库
- Resend API（邮件发送）

### 边缘计算

- Cloudflare Workers
- Cloudflare Workers AI
- Cloudflare Email Routing
- Cloudflare Pages

### AI 服务

- Cloudflare Workers AI（@cf/meta/llama-3-8b-instruct）
- ModelScope API（deepseek-ai/DeepSeek-V3.2）

## 安全说明

1. **邮件安全**
   - HTML 邮件在 sandbox iframe 中渲染，阻止脚本执行
   - 邮件数据 24 小时后自动删除
   - 不存储任何敏感信息到客户端

2. **短链接安全**
   - 创建短链接时显示安全风险提示
   - AI 自动分析目标链接安全性
   - 支持链接过期时间设置

3. **API 安全**
   - 管理员操作需要密钥验证
   - CORS 配置限制跨域请求
   - 请求频率限制

4. **数据安全**
   - 数据库连接使用 SSL
   - 敏感配置通过环境变量管理
   - 定期自动清理过期数据

## 注意事项

1. 临时邮箱仅用于接收验证码等一次性用途，请勿用于重要账户
2. 邮件在服务端保存 24 小时后自动删除
3. 每个邮箱最多保留 50 封邮件
4. 短链接服务可能被滥用，请谨慎使用
5. AI 分析功能有每日免费额度限制

## 许可证

MIT License

Copyright (c) 2025 VioletTeam

详见 [LICENSE](LICENSE) 文件。
