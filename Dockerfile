# Multi-stage image following https://docs.astro.build/en/recipes/docker/ and the @astrojs/node standalone server.
# Node version must match .nvmrc; change both together. Secrets (SUPABASE_URL, SUPABASE_KEY, PARENT_SESSION_SECRET,
# SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET) are read at runtime through astro:env/server from the server's env_file,
# never baked into the image.
FROM node:22.14.0-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./

FROM base AS prod-deps
RUN npm ci --omit=dev

FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.14.0-bookworm-slim AS runtime
LABEL org.opencontainers.image.source=https://github.com/vince307/mathshop
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4401
WORKDIR /app
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4401
CMD ["node", "./dist/server/entry.mjs"]
