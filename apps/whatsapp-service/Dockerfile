# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install --legacy-peer-deps -g turbo
COPY . .
RUN turbo prune @deviaty/whatsapp-service --docker

# Stage 2: Install and build
FROM node:20-alpine AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm install --legacy-peer-deps
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
COPY tsconfig.base.json tsconfig.base.json
RUN npx turbo run build --filter=@deviaty/whatsapp-service...
# Re-generate Prisma client for Alpine target
RUN cd packages/shared-prisma && npx prisma generate

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs
COPY --from=installer /app/apps/whatsapp-service/dist ./dist
COPY --from=installer /app/packages ./packages
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/whatsapp-service/node_modules ./node_modules
COPY --from=installer /app/apps/whatsapp-service/package.json ./package.json

EXPOSE 3006
CMD ["node", "dist/main.js"]
