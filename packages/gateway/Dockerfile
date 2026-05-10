# Multi-stage build for LLM API Gateway
# Stage 1: Build admin frontend & typecheck gateway
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json .env.example ./
COPY packages/gateway/package.json packages/gateway/tsconfig.json ./packages/gateway/
COPY packages/admin/package.json packages/admin/tsconfig.json ./packages/admin/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/gateway/src ./packages/gateway/src
COPY packages/gateway/runtimes ./packages/gateway/runtimes
COPY packages/admin/src ./packages/admin/src
COPY packages/admin/index.html packages/admin/vite.config.ts packages/admin/tailwind.config.ts packages/admin/postcss.config.js ./packages/admin/

# Build admin frontend & typecheck gateway
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy source files needed at runtime (tsx runs TypeScript directly)
COPY --from=builder /app/packages/gateway/src ./packages/gateway/src
COPY --from=builder /app/packages/gateway/runtimes ./packages/gateway/runtimes
COPY --from=builder /app/packages/gateway/package.json ./packages/gateway/
COPY --from=builder /app/packages/gateway/tsconfig.json ./packages/gateway/

# Copy built admin frontend for serving
COPY --from=builder /app/packages/admin/dist ./packages/admin/dist

# Copy workspace config for pnpm
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml /app/.npmrc ./
COPY --from=builder /app/tsconfig.base.json ./

RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app/packages/gateway
CMD ["pnpm", "start"]
