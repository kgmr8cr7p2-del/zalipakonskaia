# Team Kanban Board

Полноценный MVP командной канбан-доски в стиле Jira: Next.js, Prisma, PostgreSQL, email/password auth, регистрация по белому списку адресов, роли, одна общая доска, задачи, DnD, комментарии, чек-листы, файлы, Telegram-уведомления и экспорт в Excel.

## Запуск

1. Скопируйте переменные окружения:

```bash
cp .env.example .env
```

2. Запустите PostgreSQL:

```bash
docker compose up -d
```

3. Установите зависимости и создайте БД:

```bash
npm install
npm run prisma:migrate
npm run seed
```

4. Запустите приложение:

```bash
npm run dev
```

Демо-пользователи после seed:

- `admin@example.com` / `admin12345`
- `manager@example.com` / `admin12345`
- `executor@example.com` / `admin12345`

Самостоятельная регистрация доступна только адресам из `INVITED_EMAILS`. Подтверждение по почте отключено: разрешённые пользователи получают доступ сразу после регистрации.

## Telegram

Укажите `TELEGRAM_BOT_TOKEN`, а пользователю добавьте `Telegram chat ID` в профиле. События задач отправляются автоматически. Проверку приближающихся и просроченных дедлайнов можно дергать планировщиком через:

```bash
POST /api/notifications/deadlines
```

Чтобы бот отвечал на `/start` кнопкой «Создать задачу», укажите публичный HTTPS-адрес в `APP_URL`, задайте случайный `TELEGRAM_WEBHOOK_SECRET` и зарегистрируйте webhook:

```bash
npm run telegram:webhook
```

Команда регистрирует `/start` в меню бота и направляет Telegram на `POST /api/telegram/webhook`.
