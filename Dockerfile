FROM node:20-bookworm-slim AS builder
WORKDIR /app

ARG DATABASE_URL="mysql://dummy:dummy@localhost:3306/dummy"
ENV DATABASE_URL=${DATABASE_URL}

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .
RUN npm run build

# --- Production image ---
FROM node:20-bookworm-slim
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/main"]
