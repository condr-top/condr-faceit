# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage 2: Run ─────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

# Only prod dependencies
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Uploads folder for user avatars / screenshots
RUN mkdir -p uploads

EXPOSE 4000
CMD ["node", "dist/main"]
