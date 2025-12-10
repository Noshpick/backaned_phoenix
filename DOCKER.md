# Docker инструкции для бэкенда

## Сборка образа

```bash
docker build -t phoenix-backend .
```

## Запуск контейнера

### С использованием docker-compose (рекомендуется)

1. Создайте файл `.env` в корне проекта с необходимыми переменными окружения:
```env
POSTGRES_URI=postgresql://user:password@host:5432/database
TOKEN=your_telegram_bot_token
ADMIN_ID=your_telegram_admin_id
FRONTEND_URL=http://localhost:3001
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=your_aws_region
AWS_S3_BUCKET=your_s3_bucket
```

2. Запустите контейнер:
```bash
docker-compose up -d
```

### Без docker-compose

```bash
docker run -d \
  --name phoenix-backend \
  -p 3000:3000 \
  --env-file .env \
  phoenix-backend
```

## Миграции базы данных

Перед первым запуском необходимо выполнить миграции Prisma:

```bash
# Внутри контейнера
docker exec -it phoenix-backend npx prisma migrate deploy

# Или локально (если Prisma установлен)
npx prisma migrate deploy
```

## Просмотр логов

```bash
docker logs -f phoenix-backend
```

## Остановка и удаление

```bash
# Остановка
docker-compose down

# Остановка и удаление volumes
docker-compose down -v
```

## Healthcheck

Контейнер включает healthcheck, который проверяет доступность приложения каждые 30 секунд.

## Переменные окружения

Обязательные переменные:
- `POSTGRES_URI` - строка подключения к PostgreSQL
- `TOKEN` - токен Telegram бота
- `ADMIN_ID` - ID администратора Telegram (может быть несколько через запятую)

Опциональные:
- `PORT` - порт приложения (по умолчанию 3000)
- `NODE_ENV` - окружение (production/development)
- `FRONTEND_URL` - URL фронтенда для CORS
- `AWS_*` - настройки для S3

