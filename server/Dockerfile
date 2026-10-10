# Multi-stage Dockerfile for NIX OMS Server
FROM node:20-alpine AS builder

WORKDIR /app

COPY server/package*.json ./
RUN npm ci

COPY server/prisma ./prisma/
RUN npx prisma generate

COPY server/tsconfig.json ./
COPY server/src ./src/
RUN npm run build

# Production Runner
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

EXPOSE 5000

CMD ["node", "dist/server.js"]
