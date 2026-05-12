# LLM API Gateway

[English](#english) | [中文](#chinese)

A runtime-agnostic API gateway between client applications and a New API aggregation service. Supports Node.js, Docker, Cloudflare Workers, Vercel, and Netlify.

一个运行时无关的 API 网关，位于客户端应用与 New API 聚合服务之间。支持 Node.js、Docker、Cloudflare Workers、Vercel、Netlify 部署。

```
Client App → Gateway → New API → OpenAI / Claude / Gemini / ...
```

---

<h1 id="english">English</h1>

## Architecture

The gateway handles:
- App + device authentication & authorization
- Quota control (daily, monthly, per-device)
- Rate limiting (per app, per device, per IP, per device+profile)
- Weighted random model selection via configurable profiles
- Request parameter enforcement (max_tokens, temperature, n=1)
- SSE streaming proxy with header sanitization
- Log sanitization (PII/API key redaction)
- Web admin GUI with Chinese/English toggle

## Quick Start

**Prerequisites**: Node.js 18+, pnpm

```powershell
pnpm install
copy packages\gateway\secret.json.example packages\gateway\secret.json
```

Edit `secret.json` with your New API URL and token.

**Development** (two terminals):

```powershell
pnpm dev          # Gateway → http://localhost:3000
pnpm dev:admin    # Admin UI → http://localhost:5173
```

**Production**:

```powershell
pnpm build
pnpm start
```

The admin UI has a Chinese/English toggle button at the bottom of the sidebar.

---

## How Apps Connect to GateLLM

### No Pre-Configured API Keys

Apps do **not** need a manually-issued token. The gateway uses `X-App-Id` + `X-Device-Id` for identification and access control. Devices are auto-registered on first request.

### Client Integration

1. On first launch, the app generates a random device identifier (UUID v4), e.g. `device_id` or `install_id`, and saves it to local storage.
2. Every request includes this identifier.

**Example: JavaScript / TypeScript client**

```ts
// ---- 1. Generate & persist device ID (run once on first launch) ----

function getOrCreateDeviceId(): string {
  const KEY = 'gateway_device_id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()          // e.g. "a1b2c3d4-e5f6-..."
    localStorage.setItem(KEY, id)
  }
  return id
}

const DEVICE_ID = getOrCreateDeviceId()

// ---- 2. Chat completion helper ----

interface ChatOptions {
  messages: { role: string; content: string }[]
  profile?: string
  stream?: boolean
}

async function chat(options: ChatOptions) {
  const body: Record<string, unknown> = {
    profile: options.profile || 'app-fast',
    messages: options.messages,
    stream: options.stream ?? true,
  }

  const resp = await fetch('https://your-gateway.example.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': 'desktop-app',
      'X-Device-Id': DEVICE_ID,
      'X-App-Version': '1.0.0',
      'X-Platform': navigator.platform,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const err = await resp.json()
    throw new Error(err.error?.message || `Gateway error ${resp.status}`)
  }

  // ---- 3. Read SSE stream ----
  if (options.stream ?? true) {
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const json = line.slice(6)
          if (json === '[DONE]') return
          const chunk = JSON.parse(json)
          const content = chunk.choices?.[0]?.delta?.content
          if (content) {
            // Render content incrementally in your UI
            onStreamChunk(content)
          }
        }
      }
    }
  } else {
    // Non-streaming
    const data = await resp.json()
    console.log(data.choices?.[0]?.message?.content)
  }
}

function onStreamChunk(text: string) {
  // Append text to your chat UI
}
```

**Example: Python client**

```python
import uuid
import json
import requests

# ---- 1. Device ID (persist in app data) ----
import os
DEVICE_ID_FILE = os.path.join(os.path.expanduser("~"), ".myapp_device_id")

def get_or_create_device_id():
    try:
        with open(DEVICE_ID_FILE) as f:
            return f.read().strip()
    except FileNotFoundError:
        did = str(uuid.uuid4())
        with open(DEVICE_ID_FILE, "w") as f:
            f.write(did)
        return did

DEVICE_ID = get_or_create_device_id()

# ---- 2. Chat request ----
def chat(messages, profile="app-fast", stream=True):
    resp = requests.post(
        "https://your-gateway.example.com/v1/chat/completions",
        headers={
            "Content-Type": "application/json",
            "X-App-Id": "desktop-app",
            "X-Device-Id": DEVICE_ID,
            "X-App-Version": "1.0.0",
            "X-Platform": "windows",
        },
        json={
            "profile": profile,
            "messages": messages,
            "stream": stream,
        },
        stream=stream,
    )

    if not resp.ok:
        raise Exception(resp.json().get("error", {}).get("message", "error"))

    if stream:
        for line in resp.iter_lines(decode_unicode=True):
            if line.startswith("data: "):
                data = line[6:]
                if data == "[DONE]":
                    break
                chunk = json.loads(data)
                content = chunk["choices"][0]["delta"].get("content", "")
                if content:
                    print(content, end="", flush=True)
    else:
        print(resp.json()["choices"][0]["message"]["content"])

# ---- 3. Usage ----
chat([
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"},
])
```

**Example: cURL**

```bash
# Non-streaming
curl -s https://your-gateway.example.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-App-Id: desktop-app" \
  -H "X-Device-Id: $(cat ~/.myapp_device_id)" \
  -H "X-App-Version: 1.0.0" \
  -d '{"profile":"app-fast","messages":[{"role":"user","content":"Hello!"}],"stream":false}'

# Streaming
curl -N https://your-gateway.example.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-App-Id: desktop-app" \
  -H "X-Device-Id: $(cat ~/.myapp_device_id)" \
  -H "X-App-Version: 1.0.0" \
  -d '{"profile":"app-fast","messages":[{"role":"user","content":"Hello!"}],"stream":true}'
```

### What the Gateway Does

1. Looks up the app by `X-App-Id`
2. Auto-registers the device (if `autoRegisterDevices` is on)
3. Enforces per-device daily/monthly quotas and rate limits
4. Checks model profile permissions
5. Picks a model from the profile's weighted pool
6. Injects the New API token and forwards the request
7. Streams the response back

### Security Notes

- **`device_id` is NOT a secret** — it can be forged. It is used for identification, rate limiting, statistics, and blocking.
- **For production**: enable `requireAppSecret`, implement user login, license keys, server-issued device tokens, or short-lived access tokens.
- **`NEW_API_TOKEN` must never be embedded in the client app** — it only lives on the gateway server.

---

## Deployment

### One-Click Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/afterglowsdev/APIGate)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/afterglowsdev/APIGate&fullConfiguration=true)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fafterglowsdev%2FAPIGate)

Notes:

- Cloudflare's official deploy button has monorepo limitations. For this repository, the manual Workers Build settings documented below are still the most reliable path.
- Netlify is currently the most complete one-click target for this repo because it can publish the admin panel and wire the gateway function in a single flow.
- Vercel can import from the button, but this project still depends on the checked-in root `vercel.json` and `api/gateway.ts` layout.

### 1. Node.js (Windows / Linux / Self-hosted)

Copy `.env.example` to `.env` and fill in your values:

```bash
# Required
NEW_API_BASE_URL=https://your-newapi.example.com
NEW_API_TOKEN=sk-your-newapi-token
ADMIN_PASSWORD=change-me

# Optional — change in production
ADMIN_JWT_SECRET=your-random-secret

# Storage — "file" for persistent single-server config
CONFIG_STORE_TYPE=file
CONFIG_FILE_PATH=./data/gateway-config.json
USAGE_STORE_TYPE=memory
RATE_LIMIT_STORE_TYPE=memory
DEVICE_STORE_TYPE=memory

LOG_LEVEL=info
NODE_ENV=production
PORT=3000
```

```bash
pnpm install && pnpm build && pnpm start
```

Admin GUI served at `http://localhost:3000/admin`. The admin path prefix can be changed in `src/routes/admin-spa.ts`.

### 2. Docker / Zeabur

```bash
docker build -f packages/gateway/Dockerfile -t afterglowsdev-gateway .
docker run -p 3000:3000 \
  -e NEW_API_BASE_URL=https://your-newapi.example.com \
  -e NEW_API_TOKEN=sk-your-token \
  -e ADMIN_PASSWORD=change-me \
  -e ADMIN_JWT_SECRET=your-secret \
  -e CONFIG_STORE_TYPE=file \
  afterglowsdev-gateway
```

All configuration via environment variables. For Zeabur, set the same variables in the service dashboard.

### 3. Cloudflare Workers

The repository root now includes `wrangler.toml`, so deploy from the repo root. Do not prepend `cd packages/gateway &&` in Cloudflare's build UI.

Recommended project settings:

- Root directory: repo root
- Build command: `pnpm build`
- Deploy command: `npx wrangler deploy`

Set secrets via Wrangler CLI or the Cloudflare dashboard:

```bash
wrangler secret put NEW_API_TOKEN
wrangler secret put ADMIN_PASSWORD
wrangler secret put ADMIN_JWT_SECRET
```

Default `wrangler.toml`:

```toml
name = "llm-api-gateway"
main = "packages/gateway/runtimes/cloudflare-worker.ts"
compatibility_date = "2026-05-12"

[vars]
NEW_API_BASE_URL = "https://your-newapi.example.com"
LOG_LEVEL = "info"
```

Deploy:

```bash
pnpm build
npx wrangler deploy
```

Admin UI for Workers should be deployed separately as a static site, for example with Cloudflare Pages:

- Build command: `pnpm --filter @afterglowsdev/admin build`
- Build output directory: `packages/admin/dist`

**Storage**: the current Workers runtime uses in-memory stores. Config, usage, rate-limit counters, and devices are reset after cold starts or redeploys. If you need persistent config/device storage on Cloudflare, add a KV or D1 backed store implementation.

### 4. Vercel

The repository root now includes `vercel.json` and `api/gateway.ts`, so Vercel can deploy directly from the monorepo root. Set Environment Variables in Vercel project settings:

| Variable | Notes |
|----------|-------|
| `NEW_API_BASE_URL` | New API upstream URL |
| `NEW_API_TOKEN` | **Use Vercel Secrets** |
| `ADMIN_PASSWORD` | Admin password |
| `ADMIN_JWT_SECRET` | JWT signing secret |
| `GATEWAY_CONFIG_JSON` | JSON config when `CONFIG_STORE_TYPE=env` (read-only) |
| `CONFIG_STORE_TYPE` | `env` (read-only) or `memory` (editable but lost on cold start) |

Recommended project settings:

- Root directory: repo root
- Build command: `pnpm build`
- Output directory: `packages/admin/dist`

Deploy:

```bash
vercel deploy
```

The admin UI is served from the static output, and `/api/admin/*`, `/health`, `/v1/chat/completions` are rewritten to `api/gateway.ts`.

### 5. Netlify

The repository root now includes `netlify.toml` and `netlify/functions/gateway.ts`. Deploy from the repo root and do not override the publish directory with `dist`.

Recommended site settings:

- Base directory: leave empty
- Build command: `pnpm build`
- Publish directory: `packages/admin/dist`
- Functions directory: `netlify/functions`

Set Environment Variables in Site settings:

| Variable | Notes |
|----------|-------|
| `NEW_API_BASE_URL` | New API upstream URL |
| `NEW_API_TOKEN` | New API upstream token |
| `ADMIN_PASSWORD` | Admin password |
| `ADMIN_JWT_SECRET` | JWT signing secret |
| `LOG_LEVEL` | Optional, default `info` |

Deploy:

```bash
pnpm build
netlify deploy --prod
```

Or connect the Git repository and let Netlify use the checked-in `netlify.toml`.

How it works on Netlify:

- Static admin panel is published from `packages/admin/dist`
- `/api/admin/*`, `/health`, `/v1/chat/completions` are redirected to `/.netlify/functions/gateway`
- Gateway config and device records use Netlify Blobs
- Usage and rate-limit counters still use `memory`

**Storage**: Netlify Blobs provides native persistent storage — no external Redis needed. Config and device data survive cold starts. Usage and rate-limit counters still use `memory` (acceptable for single-function deployments).

### Deployment Comparison

| | Node.js | Docker | CF Workers | Vercel | Netlify |
|---|---|---|---|---|---|
| Config persistence | file ✓ | file ✓ | KV / memory | env / redis | Blobs ✓ |
| Admin GUI editing | ✓ | ✓ | needs KV | needs redis | ✓ |
| Multi-instance rate limit | single-server | single-server | imprecise | imprecise | imprecise |
| Complexity | low | low | medium | medium | low |

## Configuration

### Server / 服务器

**Port / 端口** — three levels of precedence, highest first / 三层优先级，从高到低：

1. System environment variable / 系统环境变量: `PORT`
2. `secret.json`: `"PORT": "3000"`
3. Code default / 代码默认值: `3000`

For serverless platforms such as Cloudflare Workers, Netlify Functions, and Vercel Functions, you normally do not need to configure `PORT`. The platform provides the HTTP entrypoint for you. `PORT` is only relevant for local Node.js, Docker, and self-hosted server processes.

```powershell
# Temporary / 临时
$env:PORT=8080; pnpm start

# Linux / macOS / Docker
PORT=8080 pnpm start
```

In `secret.json`:
```json
{ "PORT": "8080" }
```

**Admin path prefix / 管理后台路径** — change in `src/routes/admin-spa.ts`, variable `ADMIN_PATH`. Default `/admin`, can be set to `/manage/` or any custom path.

### Storage Backends

| Backend | Config Store | Usage Store | Rate Limit Store | Device Store |
|---------|-------------|-------------|-----------------|--------------|
| Memory | ✓ | ✓ | ✓ | ✓ |
| File (Node.js) | ✓ | ✓ | — | ✓ |
| Env var (read-only) | ✓ | — | — | — |
| Netlify Blobs | ✓ | — | — | ✓ |
| Redis | planned | planned | planned | — |

Set via environment or `secret.json`:

```
CONFIG_STORE_TYPE=file
USAGE_STORE_TYPE=memory
RATE_LIMIT_STORE_TYPE=memory
DEVICE_STORE_TYPE=memory
```

**Note**: Memory stores are lost on restart. Use file stores for single-server Node.js. Netlify uses Blobs natively (no external service). Redis for other serverless platforms.

### Validation Strategy

- **Save**: Lenient — structural checks only, allows drafts
- **Enable**: Strict — profile/app must be complete before enabling
- **Runtime**: Strict — validates on every request

## API

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/v1/chat/completions` | Chat completions proxy |

### Admin (requires login)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/login` | Admin login |
| POST | `/api/admin/logout` | Admin logout |
| GET | `/api/admin/session` | Check session |
| GET | `/api/admin/status` | Gateway status |
| GET | `/api/admin/config` | Get config |
| PUT | `/api/admin/config` | Save config |
| GET | `/api/admin/devices` | List devices |
| POST | `/api/admin/devices/:appId/:deviceId/block` | Block a device |
| POST | `/api/admin/devices/:appId/:deviceId/unblock` | Unblock a device |
| PUT | `/api/admin/devices/:appId/:deviceId/note` | Update device note |
| POST | `/api/admin/test` | Test chat request |

## Project Structure

```
packages/
  gateway/          # Backend (Hono + TypeScript)
    src/
      app.ts        # Hono app factory
      types/        # Type definitions
      interfaces/   # Store interfaces
      services/     # Auth, quota, rate-limit, proxy, etc.
      routes/       # API route handlers
      stores/       # Storage implementations (memory, file, env, netlify-blobs)
      utils/        # Utility functions
    runtimes/       # Platform entry points (node, cloudflare, vercel, netlify)
  admin/            # Frontend (Vue 3 + Vite + Tailwind)
    src/
      locales/      # Chinese / English language packs
      pages/        # Login, Dashboard, Profiles, Apps, Devices, Playground
      components/   # AppLayout, Sidebar, etc.
      stores/       # Pinia stores
      api/          # API client
```

## License

MIT

---

## 平台部署速查

下面这几条以仓库根目录下的配置文件为准：

- `netlify.toml`
- `vercel.json`
- `wrangler.toml`

### Cloudflare Workers

- 从仓库根目录部署，不要再写 `cd packages/gateway && ...`
- Build command：`pnpm build`
- Deploy command：`npx wrangler deploy`
- Worker 入口：`packages/gateway/runtimes/cloudflare-worker.ts`
- Secret：`NEW_API_TOKEN`、`ADMIN_PASSWORD`、`ADMIN_JWT_SECRET`
- 普通变量：`NEW_API_BASE_URL`、`LOG_LEVEL`

说明：当前 Workers 运行时还是内存存储，冷启动或重新部署后，配置、设备、额度和限流计数都会重置。管理后台建议单独部署到 Cloudflare Pages，构建命令用 `pnpm --filter @afterglowsdev/admin build`，输出目录填 `packages/admin/dist`。

### Netlify

- Base directory：留空
- Build command：`pnpm build`
- Publish directory：`packages/admin/dist`
- Functions directory：`netlify/functions`
- Netlify Function 入口：`netlify/functions/gateway.ts`

需要配置的环境变量：

- `NEW_API_BASE_URL`
- `NEW_API_TOKEN`
- `ADMIN_PASSWORD`
- `ADMIN_JWT_SECRET`
- `LOG_LEVEL`（可选）

说明：Netlify 会把 `packages/admin/dist` 当静态站点发布，再把 `/api/admin/*`、`/health`、`/v1/chat/completions` 转发到 `/.netlify/functions/gateway`。配置和设备信息走 Netlify Blobs，能持久化；用量和限流计数还是内存级别，只能算近似值。

### Vercel

- Root directory：留空
- Build command：`pnpm build`
- Output directory：`packages/admin/dist`
- Function 入口：`api/gateway.ts`

如果需要把整个项目部署到 Vercel，仓库根目录现在也已经补了 `vercel.json`，不用再额外手搓路由重写。

---

<h1 id="chinese">中文</h1>

## 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/afterglowsdev/APIGate)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/afterglowsdev/APIGate&fullConfiguration=true)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fafterglowsdev%2FAPIGate)

说明：

- Cloudflare 的官方按钮对 monorepo 支持一般，这个仓库更建议按下面的手动参数部署。
- Netlify 目前是一键部署体验最完整的平台，同一个流程里就能把管理后台和网关函数接起来。
- Vercel 按钮可以直接导入仓库，但仍然依赖仓库根目录下的 `vercel.json` 和 `api/gateway.ts`。

## 整体架构

```
客户端 App → 本网关 → New API → OpenAI / Claude / Gemini / ...
```

网关负责：
- 应用 + 设备鉴权与授权
- 额度控制（每日、每月，按设备维度）
- 限流（按应用、设备、IP、设备+档位）
- 基于配置档位的加权随机模型选择
- 请求参数强制限制（max_tokens、temperature、n=1）
- SSE 流式转发及请求头清理
- 日志脱敏（敏感信息 / API Key 遮盖）
- Web 管理后台（支持中英文切换）

## 快速开始

**前提条件**：Node.js 18+、pnpm

```powershell
pnpm install
copy packages\gateway\secret.json.example packages\gateway\secret.json
```

在 `secret.json` 中填入 New API 地址和 Token。

**开发模式**（需要两个终端）：

```powershell
pnpm dev          # 网关 → http://localhost:3000
pnpm dev:admin    # 管理后台 → http://localhost:5173
```

**生产构建**：

```powershell
pnpm build
pnpm start
```

管理后台侧边栏底部有中英文切换按钮。

---

## App 如何接入 GateLLM

### 不需要预配 API Key

App 不需要管理员手动签发 Token。网关使用 `X-App-Id` + `X-Device-Id` 做身份识别和访问控制。设备首次请求时自动注册，管理员无需逐个添加用户。

### 客户端接入步骤

1. App 首次启动时生成一个随机设备标识（UUID v4），如 `device_id` 或 `install_id`，保存到本地存储
2. 每次请求 GateLLM 时带上该标识

**示例：JavaScript / TypeScript 客户端**

```ts
// ---- 1. 生成并持久化设备 ID（首次启动执行一次） ----

function getOrCreateDeviceId(): string {
  const KEY = 'gateway_device_id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()          // 例如 "a1b2c3d4-e5f6-..."
    localStorage.setItem(KEY, id)
  }
  return id
}

const DEVICE_ID = getOrCreateDeviceId()

// ---- 2. 聊天补全请求 ----

interface ChatOptions {
  messages: { role: string; content: string }[]
  profile?: string
  stream?: boolean
}

async function chat(options: ChatOptions) {
  const body: Record<string, unknown> = {
    profile: options.profile || 'app-fast',
    messages: options.messages,
    stream: options.stream ?? true,
  }

  const resp = await fetch('https://your-gateway.example.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': 'desktop-app',
      'X-Device-Id': DEVICE_ID,
      'X-App-Version': '1.0.0',
      'X-Platform': navigator.platform,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const err = await resp.json()
    throw new Error(err.error?.message || `网关错误 ${resp.status}`)
  }

  // ---- 3. 读取 SSE 流式响应 ----
  if (options.stream ?? true) {
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const json = line.slice(6)
          if (json === '[DONE]') return
          const chunk = JSON.parse(json)
          const content = chunk.choices?.[0]?.delta?.content
          if (content) {
            // 在你的 UI 中逐字渲染
            onStreamChunk(content)
          }
        }
      }
    }
  } else {
    // 非流式
    const data = await resp.json()
    console.log(data.choices?.[0]?.message?.content)
  }
}

function onStreamChunk(text: string) {
  // 追加到聊天界面
}
```

**示例：Python 客户端**

```python
import uuid, json, os
import requests

# ---- 1. 持久化设备 ID ----
DEVICE_ID_FILE = os.path.join(os.path.expanduser("~"), ".myapp_device_id")

def get_or_create_device_id():
    try:
        with open(DEVICE_ID_FILE) as f:
            return f.read().strip()
    except FileNotFoundError:
        did = str(uuid.uuid4())
        with open(DEVICE_ID_FILE, "w") as f:
            f.write(did)
        return did

DEVICE_ID = get_or_create_device_id()

# ---- 2. 聊天补全 ----
def chat(messages, profile="app-fast", stream=True):
    resp = requests.post(
        "https://your-gateway.example.com/v1/chat/completions",
        headers={
            "Content-Type": "application/json",
            "X-App-Id": "desktop-app",
            "X-Device-Id": DEVICE_ID,
            "X-App-Version": "1.0.0",
            "X-Platform": "windows",
        },
        json={
            "profile": profile,
            "messages": messages,
            "stream": stream,
        },
        stream=stream,
    )

    if not resp.ok:
        raise Exception(resp.json().get("error", {}).get("message", "error"))

    if stream:
        for line in resp.iter_lines(decode_unicode=True):
            if line.startswith("data: "):
                data = line[6:]
                if data == "[DONE]":
                    break
                chunk = json.loads(data)
                content = chunk["choices"][0]["delta"].get("content", "")
                if content:
                    print(content, end="", flush=True)
    else:
        print(resp.json()["choices"][0]["message"]["content"])

# ---- 3. 调用 ----
chat([
    {"role": "system", "content": "你是一个有用的助手。"},
    {"role": "user", "content": "你好！"},
])
```

**示例：cURL**

```bash
# 非流式
curl -s https://your-gateway.example.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-App-Id: desktop-app" \
  -H "X-Device-Id: $(cat ~/.myapp_device_id)" \
  -H "X-App-Version: 1.0.0" \
  -d '{"profile":"app-fast","messages":[{"role":"user","content":"你好！"}],"stream":false}'

# 流式
curl -N https://your-gateway.example.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-App-Id: desktop-app" \
  -H "X-Device-Id: $(cat ~/.myapp_device_id)" \
  -H "X-App-Version: 1.0.0" \
  -d '{"profile":"app-fast","messages":[{"role":"user","content":"你好！"}],"stream":true}'
```

### 网关自动处理

1. 通过 `X-App-Id` 查找应用配置
2. 自动注册新设备（如果应用开启了 `autoRegisterDevices`）
3. 按设备维度执行每日/每月额度和限流
4. 检查模型档位权限
5. 从档位模型池中按权重随机选择模型
6. 注入 New API Token 并转发请求
7. 将响应流式返回给 App

### 安全说明

- **`device_id` 不是密钥** — 可被恶意客户端伪造。它用于识别、限流、统计和封禁，不能作为强认证。
- **正式产品建议**：启用 `requireAppSecret`、接入用户登录、License 授权、服务端签发 device_token 或短期 access token。
- **`NEW_API_TOKEN` 绝不能进入客户端 App** — 只存在于网关服务端。

---

## 部署方式

### 1. Node.js（Windows / Linux / 自有服务器）

复制 `.env.example` 为 `.env` 并填写：

```bash
# 必填
NEW_API_BASE_URL=https://your-newapi.example.com
NEW_API_TOKEN=sk-your-newapi-token
ADMIN_PASSWORD=change-me

# 可选 — 生产环境务必修改
ADMIN_JWT_SECRET=your-random-secret

# 存储 — 单机部署推荐 file（持久化到磁盘）
CONFIG_STORE_TYPE=file
CONFIG_FILE_PATH=./data/gateway-config.json
USAGE_STORE_TYPE=memory
RATE_LIMIT_STORE_TYPE=memory
DEVICE_STORE_TYPE=memory

LOG_LEVEL=info
NODE_ENV=production
PORT=3000
```

```bash
pnpm install && pnpm build && pnpm start
```

管理后台由网关直接提供：`http://localhost:3000/admin`。后台路径可在 `src/routes/admin-spa.ts` 中修改 `ADMIN_PATH` 变量。

### 2. Docker / Zeabur

```bash
docker build -f packages/gateway/Dockerfile -t afterglowsdev-gateway .
docker run -p 3000:3000 \
  -e NEW_API_BASE_URL=https://your-newapi.example.com \
  -e NEW_API_TOKEN=sk-your-token \
  -e ADMIN_PASSWORD=change-me \
  -e ADMIN_JWT_SECRET=your-secret \
  -e CONFIG_STORE_TYPE=file \
  afterglowsdev-gateway
```

所有配置通过环境变量传入。Zeabur 在控制台设置同名环境变量即可。

### 3. Cloudflare Workers

复制 `wrangler.toml.example` 为 `wrangler.toml`。用 Wrangler CLI 设置 Secret：

```bash
wrangler secret put NEW_API_TOKEN
wrangler secret put ADMIN_PASSWORD
wrangler secret put ADMIN_JWT_SECRET
```

`wrangler.toml` 中配置普通变量：

```toml
[vars]
NEW_API_BASE_URL = "https://your-newapi.example.com"
LOG_LEVEL = "info"
CONFIG_STORE_TYPE = "memory"
```

部署：`wrangler deploy`。管理后台需单独部署到 Cloudflare Pages。

**存储说明**：Workers 是无状态 Serverless。配置默认用 `memory`（重启后需通过后台重新配置），可绑定 KV namespace 实现持久化（`cloudflare-kv`）。

### 4. Vercel

项目已含 `vercel.json`。在 Vercel 项目设置中添加 Environment Variables：

| 变量 | 说明 |
|------|------|
| `NEW_API_BASE_URL` | 上游 New API 地址 |
| `NEW_API_TOKEN` | **设为 Vercel Secret** |
| `ADMIN_PASSWORD` | 管理员密码 |
| `ADMIN_JWT_SECRET` | JWT 签名密钥 |
| `GATEWAY_CONFIG_JSON` | 当 `CONFIG_STORE_TYPE=env` 时的 JSON 配置（只读） |
| `CONFIG_STORE_TYPE` | `env`（只读）或 `memory`（可编辑但冷启动丢失） |

部署：`vercel deploy`。管理后台单独部署为静态站点。

### 5. Netlify

项目已含 `netlify.toml`。在 Site settings 中添加 Environment Variables：

| 变量 | 说明 |
|------|------|
| `NEW_API_BASE_URL` | 上游 New API 地址 |
| `NEW_API_TOKEN` | 上游 New API Token |
| `ADMIN_PASSWORD` | 管理员密码 |
| `ADMIN_JWT_SECRET` | JWT 签名密钥 |
| `GATEWAY_CONFIG_JSON` | 当 `CONFIG_STORE_TYPE=env` 时的 JSON 配置（只读） |
| `CONFIG_STORE_TYPE` | `netlify-blobs`（默认，持久化）或 `memory` |

部署：`netlify deploy --prod`。

**存储说明**：Netlify Blobs 提供原生持久化存储 — 无需外部 Redis。配置和设备数据冷启动后不丢失。用量和限流计数器仍使用 `memory`（单函数部署可接受）。

### 部署方式对比

| | Node.js | Docker | CF Workers | Vercel | Netlify |
|---|---|---|---|---|---|
| 配置持久化 | file ✓ | file ✓ | KV / memory | env / redis | Blobs ✓ |
| 后台在线编辑 | ✓ | ✓ | 需 KV | 需 redis | ✓ |
| 多实例精确限流 | 单机 OK | 单机 OK | 不精确 | 不精确 | 不精确 |
| 部署复杂度 | 低 | 低 | 中 | 中 | 低 |

## 配置说明

### 服务器

**端口** — 三层优先级，从高到低：

1. 系统环境变量: `PORT`
2. `secret.json`: `"PORT": "3000"`
3. 代码默认值: `3000`

补充说明：Cloudflare Workers、Netlify Functions、Vercel Functions 这类 Serverless 平台通常不需要你自己配置 `PORT`。HTTP 入口由平台托管，`PORT` 只对本地 Node.js、Docker、自建服务器这类自己监听端口的部署方式有意义。

```powershell
# Windows 临时设置
$env:PORT=8080; pnpm start

# Linux / macOS / Docker
PORT=8080 pnpm start
```

在 `secret.json` 中：
```json
{ "PORT": "8080" }
```

**管理后台路径** — 修改 `src/routes/admin-spa.ts` 中的 `ADMIN_PATH` 变量。默认 `/admin`，可改为 `/manage/` 或自定义路径。

### 存储后端

| 后端 | 配置存储 | 用量存储 | 限流存储 | 设备存储 |
|------|---------|---------|---------|---------|
| 内存 (Memory) | ✓ | ✓ | ✓ | ✓ |
| 文件 (File, Node.js) | ✓ | ✓ | — | ✓ |
| 环境变量 (Env, 只读) | ✓ | — | — | — |
| Netlify Blobs | ✓ | — | — | ✓ |
| Redis | 计划中 | 计划中 | 计划中 | — |

通过环境变量或 `secret.json` 设置：

```
CONFIG_STORE_TYPE=file
USAGE_STORE_TYPE=memory
RATE_LIMIT_STORE_TYPE=memory
DEVICE_STORE_TYPE=memory
```

**注意**：内存在重启后丢失。单机 Node.js 用 file 持久化。Netlify 原生使用 Blobs，无需外部服务。其他 Serverless 平台可用 Redis。

### 校验策略

- **保存时**：宽松校验 — 仅结构检查，允许保存草稿
- **启用时**：严格校验 — 档位/应用必须完整才能启用
- **运行时**：严格校验 — 每次请求均做校验

## API 接口

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/v1/chat/completions` | 聊天补全代理 |

### 管理接口（需登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 管理员登录 |
| POST | `/api/admin/logout` | 管理员登出 |
| GET | `/api/admin/session` | 检查会话 |
| GET | `/api/admin/status` | 网关状态 |
| GET | `/api/admin/config` | 获取配置 |
| PUT | `/api/admin/config` | 保存配置 |
| GET | `/api/admin/devices` | 设备列表 |
| POST | `/api/admin/devices/:appId/:deviceId/block` | 封禁设备 |
| POST | `/api/admin/devices/:appId/:deviceId/unblock` | 解封设备 |
| PUT | `/api/admin/devices/:appId/:deviceId/note` | 更新设备备注 |
| POST | `/api/admin/test` | 测试请求 |

## 项目结构

```
packages/
  gateway/          # 后端 (Hono + TypeScript)
    src/
      app.ts        # Hono 应用工厂
      types/        # 类型定义
      interfaces/   # 存储接口
      services/     # 鉴权、额度、限流、代理等服务
      routes/       # API 路由处理
      stores/       # 存储实现（memory、file、env）
      utils/        # 工具函数
    runtimes/       # 平台入口适配（node、cloudflare、vercel、netlify）
  admin/            # 前端 (Vue 3 + Vite + Tailwind)
    src/
      locales/      # 中英文语言包
      pages/        # 登录、仪表盘、档位、应用、设备、调试工具
      components/   # 布局、侧边栏等组件
      stores/       # Pinia 状态管理
      api/          # API 请求封装
```

## 许可证

MIT
