# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune @deviaty/auth-service --docker

# Stage 2: Install and build
FROM node:20-alpine AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm install
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
COPY tsconfig.base.json tsconfig.base.json
RUN npx turbo run build --filter=@deviaty/auth-service...

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs
COPY --from=installer /app/apps/auth-service/dist ./dist
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/auth-service/package.json ./package.json

EXPOSE 3001
CMD ["node", "dist/main.js"]
