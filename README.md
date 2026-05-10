# LLM API Secure Forwarding Gateway / LLM API 安全转发网关

A runtime-agnostic API gateway that sits between client applications and a [New API](https://github.com/Calcium-Ion/new-api) aggregation service, providing authentication, rate limiting, quota control, model routing, and an admin GUI.

一个运行时无关的 API 网关，位于客户端应用与 [New API](https://github.com/Calcium-Ion/new-api) 聚合服务之间，提供鉴权、限流、额度控制、模型路由和管理后台。

## Architecture / 整体架构

```
Client App → Gateway (this project / 本项目) → New API → OpenAI / Claude / Gemini / ...
```

The gateway handles / 网关负责：
- Client authentication & authorization / 客户端鉴权与授权
- Quota control (daily, monthly, per-minute) / 额度控制（每日、每月、每分钟）
- Rate limiting (per client, IP, client+IP) / 限流（按客户端、IP、客户端+IP）
- Weighted random model selection via profiles / 基于配置档位的加权随机模型选择
- Request parameter enforcement / 请求参数强制限制
- SSE streaming proxy with header sanitization / SSE 流式转发及请求头清理
- Log sanitization (PII/API key redaction) / 日志脱敏
- Web admin GUI for configuration / Web 管理后台

## Quick Start / 快速开始

### Prerequisites / 前提条件

- Node.js 18+
- pnpm

### Setup / 安装

```powershell
pnpm install
```

Copy and edit the secrets file / 复制并编辑密钥文件：

```powershell
copy packages\gateway\secret.json.example packages\gateway\secret.json
```

Edit `secret.json` with your New API URL and token.
在 `secret.json` 中填入你的 New API 地址和 Token。

### Development / 开发模式

Run both the gateway and admin UI (two terminals required).
需要两个终端分别启动网关和管理后台：

```powershell
# Terminal 1: Gateway API / 网关 API
pnpm dev

# Terminal 2: Admin UI / 管理后台
pnpm dev:admin
```

- Gateway API / 网关 API：http://localhost:3000
- Admin UI / 管理后台：http://localhost:5173
- Health check / 健康检查：http://localhost:3000/health

Admin UI supports Chinese/English toggle — click the language button in the sidebar.
管理后台支持中英文切换 — 点击侧边栏底部的语言按钮即可切换。

### Production Build / 生产构建

```powershell
pnpm build
```

## Deployment / 部署方式

### Node.js / Docker

```powershell
copy .env.example .env
pnpm build
pnpm start
```

### Cloudflare Workers

1. Copy `wrangler.toml.example` to `wrangler.toml`
2. Set secrets: `wrangler secret put NEW_API_TOKEN`
3. Deploy: `wrangler deploy`

### Vercel / Netlify

Use the platform-specific config files (`vercel.json`, `netlify.toml`) for routing. Deploy the admin as a static site separately, or use the Node.js runtime.
使用对应的配置文件（`vercel.json`、`netlify.toml`）配置路由。管理后台可单独部署为静态站点。

## Configuration / 配置说明

### Storage Backends / 存储后端

| Backend / 后端 | Config Store | Usage Store | Rate Limit Store |
|---------------|-------------|-------------|-----------------|
| Memory / 内存 | ✓ | ✓ | ✓ |
| File (Node.js) / 文件 | ✓ | ✓ | — |
| Env var (read-only) / 环境变量 | ✓ | — | — |
| Cloudflare KV | planned / 计划中 | planned / 计划中 | planned / 计划中 |
| Redis | planned / 计划中 | planned / 计划中 | planned / 计划中 |

Set via environment or `secret.json` / 通过环境变量或 `secret.json` 设置：

```
CONFIG_STORE_TYPE=file
CONFIG_FILE_PATH=./data/gateway-config.json
USAGE_STORE_TYPE=memory
RATE_LIMIT_STORE_TYPE=memory
```

**Note**: Memory stores are lost on restart and not suitable for production multi-instance deployments. Use file stores for single-server Node.js deployments, or Redis for serverless.
**注意**：内存存储在重启后丢失，不适合生产多实例部署。单机 Node.js 部署可使用文件存储，Serverless 环境建议使用 Redis。

### Validation Strategy / 校验策略

- **Save / 保存时**: Lenient — structural checks only, allows drafts / 宽松校验，仅做结构检查，允许保存草稿
- **Enable / 启用时**: Strict — profile/client must be complete before enabling / 严格校验，档位/客户端必须完整才能启用
- **Runtime / 运行时**: Strict — validates on every request / 严格校验，每次请求均做校验

## API / API 接口

### Public / 公开接口

| Method | Path | Description / 说明 |
|--------|------|-------------------|
| GET | `/health` | Health check / 健康检查 |
| POST | `/v1/chat/completions` | Chat completions proxy / 聊天补全代理 |

### Admin (requires login / 需登录)

| Method | Path | Description / 说明 |
|--------|------|-------------------|
| POST | `/api/admin/login` | Admin login / 管理员登录 |
| POST | `/api/admin/logout` | Admin logout / 管理员登出 |
| GET | `/api/admin/session` | Check session / 检查会话 |
| GET | `/api/admin/status` | Gateway status / 网关状态 |
| GET | `/api/admin/config` | Get config / 获取配置 |
| PUT | `/api/admin/config` | Save config / 保存配置 |
| POST | `/api/admin/test` | Test chat request / 测试请求 |

## Project Structure / 项目结构

```
packages/
  gateway/          # Backend (Hono + TypeScript) / 后端
    src/
      app.ts        # Hono app factory / 应用工厂
      types/        # Type definitions / 类型定义
      interfaces/   # Store interfaces / 存储接口
      services/     # Auth, quota, rate-limit, proxy, etc. / 鉴权、额度、限流、代理等服务
      routes/       # API route handlers / API 路由处理
      stores/       # Storage implementations / 存储实现
      utils/        # Pure utility functions / 纯工具函数
    runtimes/       # Platform entry points / 平台入口适配
  admin/            # Frontend (Vue 3 + Vite + Tailwind) / 前端
    src/
      locales/      # zh.ts / en.ts language packs / 中英文语言包
      pages/        # Login, Dashboard, Profiles, etc. / 各页面
      components/   # AppLayout, Sidebar, etc. / 通用组件
      stores/       # Pinia stores / Pinia 状态管理
      api/          # API client / API 请求封装
```

## License / 许可证

MIT
