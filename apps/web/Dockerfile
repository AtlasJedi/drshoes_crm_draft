# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /workspace
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/api-types/package.json ./packages/api-types/
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /workspace
COPY --from=deps /workspace ./
COPY apps/web ./apps/web
COPY packages/ui ./packages/ui
COPY packages/api-types ./packages/api-types
# INTERNAL_API_BASE must be available at build time so next.config.mjs async rewrites()
# can bake the /api/:path* → backend rewrite into the standalone build. Without it the
# routes-manifest contains empty rewrite arrays and all /api/* calls return 404.
ARG INTERNAL_API_BASE=http://backend:8080
ENV INTERNAL_API_BASE=${INTERNAL_API_BASE}
RUN pnpm --filter @drshoes/web build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /workspace/apps/web/.next/standalone ./
COPY --from=build /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /workspace/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
