# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src ./src

# Stage 2: Runtime
FROM node:20-alpine AS runtime
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/src ./src

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode < 400 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]
