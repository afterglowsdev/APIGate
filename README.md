# LLM API Secure Forwarding Gateway

A runtime-agnostic API gateway that sits between client applications and a [New API](https://github.com/Calcium-Ion/new-api) aggregation service, providing authentication, rate limiting, quota control, model routing, and an admin GUI.

## Architecture

```
Client App → Gateway (this project) → New API → OpenAI / Claude / Gemini / ...
```

The gateway handles:
- Client authentication & authorization
- Quota control (daily, monthly, per-minute)
- Rate limiting (per client, IP, client+IP)
- Weighted random model selection via profiles
- Request parameter enforcement
- SSE streaming proxy with header sanitization
- Log sanitization (PII/API key redaction)
- Web admin GUI for configuration

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```powershell
pnpm install
```

Copy and edit the secrets file:

```powershell
copy packages\gateway\secret.json.example packages\gateway\secret.json
```

Edit `secret.json` with your New API URL and token.

### Development

Run both the gateway and admin UI:

```powershell
# Terminal 1: Gateway API
pnpm dev

# Terminal 2: Admin UI
pnpm dev:admin
```

- Gateway API: http://localhost:3000
- Admin UI: http://localhost:5173
- Health check: http://localhost:3000/health

### Production Build

```powershell
pnpm build
```

## Deployment

### Node.js / Docker

```powershell
# Copy example configs
copy .env.example .env

# Build and start
pnpm build
pnpm start
```

### Cloudflare Workers

1. Copy `wrangler.toml.example` to `wrangler.toml`
2. Set secrets: `wrangler secret put NEW_API_TOKEN`
3. Deploy: `wrangler deploy`

### Vercel / Netlify

Use the platform-specific config files (`vercel.json`, `netlify.toml`) for routing. Deploy the admin as a static site separately, or use the Node.js runtime.

## Configuration

### Storage Backends

| Backend | Config Store | Usage Store | Rate Limit Store |
|---------|-------------|-------------|-----------------|
| Memory | ✓ | ✓ | ✓ |
| File (Node.js) | ✓ | ✓ | — |
| Env var (read-only) | ✓ | — | — |
| Cloudflare KV | planned | planned | planned |
| Redis | planned | planned | planned |

Set via environment or `secret.json`:

```
CONFIG_STORE_TYPE=file
CONFIG_FILE_PATH=./data/gateway-config.json
USAGE_STORE_TYPE=memory
RATE_LIMIT_STORE_TYPE=memory
```

**Note**: Memory stores are lost on restart and not suitable for production multi-instance deployments. Use file stores for single-server Node.js deployments, or Redis for serverless.

### Validation Strategy

- **Save**: Lenient — structural checks only, allows drafts
- **Enable**: Strict — profile/client must be complete before enabling
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
      stores/       # Storage implementations
      utils/        # Pure utility functions
    runtimes/       # Platform entry points
  admin/            # Frontend (Vue 3 + Vite + Tailwind)
    src/
      pages/        # Login, Dashboard, Profiles, etc.
      components/   # AppLayout, Sidebar, etc.
      stores/       # Pinia stores
      api/          # API client
```

## License

MIT
