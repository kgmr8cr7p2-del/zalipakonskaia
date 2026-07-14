import { prisma } from "@/lib/prisma";

type TelegramEvent =
  | "task_created"
  | "assignee_changed"
  | "status_changed"
  | "comment_added"
  | "deadline_soon"
  | "deadline_overdue"
  | "deadline_reminder"
  | "weekly_report"
  | "account_registered"
  | "password_reset";

const titles: Record<TelegramEvent, string> = {
  task_created: "Новая задача",
  assignee_changed: "Исполнители обновлены",
  status_changed: "Статус задачи изменён",
  comment_added: "Новый комментарий",
  deadline_soon: "Скоро дедлайн",
  deadline_overdue: "Дедлайн просрочен",
  deadline_reminder: "Напоминание о задаче",
  weekly_report: "Еженедельный отчёт",
  account_registered: "Новый пользователь",
  password_reset: "Пароль восстановлен",
};

const icons: Record<TelegramEvent, string> = {
  task_created: "🟣",
  assignee_changed: "👤",
  status_changed: "🔄",
  comment_added: "💬",
  deadline_soon: "⏳",
  deadline_overdue: "🔴",
  deadline_reminder: "🔔",
  weekly_report: "📊",
  account_registered: "👋",
  password_reset: "🔐",
};

const taskEvents = new Set<TelegramEvent>([
  "task_created",
  "assignee_changed",
  "status_changed",
  "comment_added",
  "deadline_soon",
  "deadline_overdue",
  "deadline_reminder",
]);

export async function sendWeeklyReportMessage(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: 0, failed: 0, reason: "token_missing" as const };

  const connections = await prisma.telegramConnection.findMany({
    where: { enabled: true, user: { approvedAt: { not: null } } },
  });

  const chatIds = new Set([
    ...connections.map((c) => c.chatId),
    ...(process.env.TELEGRAM_DEFAULT_CHAT_ID ? [process.env.TELEGRAM_DEFAULT_CHAT_ID] : []),
  ]);

  return sendToChats(token, [...chatIds], message, "Telegram weekly report failed");
}

export async function sendTelegramStartMessage(chatId: string, connected = false) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: 0, failed: 0, reason: "token_missing" as const };

  const message = [
    "👋 <b>Taskora</b>",
    "",
    connected ? "Личный чат подключён. Сюда будут приходить напоминания с ваших личных досок." : "Создайте новую задачу прямо из Telegram — она сразу появится на доске сайта.",
  ].join("\n");

  return sendToChats(token, [chatId], message, "Telegram /start response failed");
}

export async function sendSharedTaskReminder(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_DEFAULT_CHAT_ID;
  if (!token) return { sent: 0, failed: 0, reason: "token_missing" as const };
  if (!chatId) return { sent: 0, failed: 0, reason: "channel_missing" as const };
  return sendToChats(token, [chatId], formatTelegramMessage("deadline_reminder", message), "Telegram shared reminder failed");
}

export async function sendPersonalTaskReminder(userId: string, message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: 0, failed: 0, reason: "token_missing" as const };
  const connection = await prisma.telegramConnection.findFirst({
    where: { userId, enabled: true, user: { approvedAt: { not: null } } },
  });
  if (!connection?.enabled) return { sent: 0, failed: 0, reason: "chat_missing" as const };
  return sendToChats(token, [connection.chatId], formatTelegramMessage("deadline_reminder", message), "Telegram personal reminder failed");
}

export async function notifyTelegram(event: TelegramEvent, message: string, userIds: string[] = []) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const connections = userIds.length
    ? await prisma.telegramConnection.findMany({
        where: { enabled: true, userId: { in: userIds }, user: { approvedAt: { not: null } } },
      })
    : [];

  const chatIds = new Set([
    ...connections.map((connection) => connection.chatId),
    ...(process.env.TELEGRAM_DEFAULT_CHAT_ID ? [process.env.TELEGRAM_DEFAULT_CHAT_ID] : []),
  ]);

  await sendToChats(token, [...chatIds], formatTelegramMessage(event, message), "Telegram notification failed");
}

async function sendToChats(token: string, chatIds: string[], text: string, errorLabel: string) {
  const appBaseUrl = (process.env.APP_URL ?? "https://kanban.region-free.online").replace(/\/$/, "");
  const taskUrl = `${appBaseUrl}/telegram/new-task`;
  const boardUrl = `${appBaseUrl}/board`;
  const results = await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [[
                { text: "📋 Открыть доску", url: boardUrl },
                { text: "➕ Создать задачу", url: taskUrl },
              ]],
            },
          }),
        });
        if (!response.ok) throw new Error(`Telegram API ${response.status}: ${await response.text()}`);
        return true;
      } catch (error) {
        console.error(errorLabel, error);
        return false;
      }
    }),
  );

  return {
    sent: results.filter(Boolean).length,
    failed: results.filter((result) => !result).length,
  };
}

function formatTelegramMessage(event: TelegramEvent, message: string) {
  const { taskTitle, body } = taskEvents.has(event) ? extractTaskTitle(message) : { taskTitle: "", body: message };
  const details = formatDetailLines(body);
  return [
    `${icons[event]} <b>${escapeHtml(titles[event])}</b>`,
    taskTitle ? `\n<b>${escapeHtml(taskTitle)}</b>` : null,
    details ? `\n${details}` : null,
    "",
    `🕒 <i>${new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Moscow" }).format(new Date())} · Taskora</i>`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function formatDetailLines(body: string) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator <= 0) return `• ${escapeHtml(shorten(line, 260))}`;
      const label = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim() || "не указано";
      return `• <b>${escapeHtml(label)}:</b> ${escapeHtml(shorten(value, label.toLocaleLowerCase("ru-RU").includes("комментар") ? 240 : 180))}`;
    })
    .join("\n");
}

function shorten(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function extractTaskTitle(message: string) {
  const lines = message.split("\n");
  const taskLineIndex = lines.findIndex((line) => line.toLowerCase().startsWith("задача:"));
  if (taskLineIndex >= 0) {
    const taskTitle = lines[taskLineIndex].replace(/^задача:\s*/i, "").trim();
    return {
      taskTitle,
      body: lines.filter((_, index) => index !== taskLineIndex).join("\n").trim(),
    };
  }

  const firstLine = lines[0] ?? "";
  const separator = firstLine.indexOf(":");
  if (separator > 0) {
    const taskTitle = firstLine.slice(0, separator).trim();
    const firstDetail = firstLine.slice(separator + 1).trim();
    return {
      taskTitle,
      body: [firstDetail, ...lines.slice(1)].filter(Boolean).join("\n").trim(),
    };
  }

  return { taskTitle: "", body: message };
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
