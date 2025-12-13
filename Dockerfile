FROM oven/bun:1.2-alpine AS dependencies

WORKDIR /app

COPY package.json bun.lock* ./

# Устанавливаем только production зависимости
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.2-alpine AS build

WORKDIR /app

COPY package.json bun.lock* ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Устанавливаем все зависимости (включая dev для сборки)
RUN bun install --frozen-lockfile

COPY prisma ./prisma
COPY src ./src

# Генерируем Prisma клиент
RUN bunx prisma generate

# Собираем приложение
RUN bun run build

FROM oven/bun:1.2-alpine AS production

WORKDIR /app

RUN apk add --no-cache openssl

RUN addgroup -g 1001 -S bunjs && \
    adduser -S nestjs -u 1001

# Копируем production зависимости
COPY --from=dependencies --chown=nestjs:bunjs /app/node_modules ./node_modules

# Копируем собранное приложение
COPY --from=build --chown=nestjs:bunjs /app/dist ./dist
# Копируем Prisma клиент
COPY --from=build --chown=nestjs:bunjs /app/node_modules/.prisma ./node_modules/.prisma
# Копируем Prisma схему для миграций
COPY --from=build --chown=nestjs:bunjs /app/prisma ./prisma

COPY --chown=nestjs:bunjs package.json bun.lock* ./

USER nestjs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Запускаем приложение через Bun
CMD ["bun", "dist/main.js"]

