FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package*.json ./
COPY bun.lock* ./

RUN npm ci --only=production && \
    npm cache clean --force

FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY bun.lock* ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

RUN npm ci && \
    npm cache clean --force

COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate

RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache openssl

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

COPY --from=dependencies --chown=nestjs:nodejs /app/node_modules ./node_modules

COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma

COPY --chown=nestjs:nodejs package*.json ./

USER nestjs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Команда запуска
CMD ["node", "dist/main.js"]

