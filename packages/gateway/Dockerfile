# Multi-stage build for LLM API Gateway
# Stage 1: Build
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/gateway/package.json packages/gateway/tsconfig.json ./packages/gateway/
COPY packages/admin/package.json packages/admin/tsconfig.json ./packages/admin/

RUN pnpm install --frozen-lockfile

# Copy source and build
COPY packages/gateway/src ./packages/gateway/src
COPY packages/gateway/runtimes ./packages/gateway/runtimes
COPY packages/admin/src ./packages/admin/src
COPY packages/admin/index.html packages/admin/vite.config.ts packages/admin/tailwind.config.ts packages/admin/postcss.config.js ./packages/admin/

RUN pnpm build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/packages/gateway/dist ./dist
COPY --from=builder /app/packages/gateway/package.json ./
COPY --from=builder /app/packages/admin/dist ./admin/dist

RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/runtimes/node.js"]
