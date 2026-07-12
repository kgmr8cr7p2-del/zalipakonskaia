import { prisma } from "@/lib/prisma";

type TelegramEvent =
  | "task_created"
  | "assignee_changed"
  | "status_changed"
  | "comment_added"
  | "deadline_soon"
  | "deadline_overdue"
  | "weekly_report";

const titles: Record<TelegramEvent, string> = {
  task_created: "Новая задача",
  assignee_changed: "Назначен исполнитель",
  status_changed: "Статус изменен",
  comment_added: "Новый комментарий",
  deadline_soon: "Скоро дедлайн",
  deadline_overdue: "Дедлайн просрочен",
  weekly_report: "Еженедельный отчёт",
};

const icons: Record<TelegramEvent, string> = {
  task_created: "🟣",
  assignee_changed: "👤",
  status_changed: "🔄",
  comment_added: "💬",
  deadline_soon: "⏳",
  deadline_overdue: "🔴",
  weekly_report: "📊",
};

export async function sendWeeklyReportMessage(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: 0, failed: 0, reason: "token_missing" as const };

  const connections = await prisma.telegramConnection.findMany({
    where: { enabled: true },
  });

  const chatIds = new Set([
    ...connections.map((c) => c.chatId),
    ...(process.env.TELEGRAM_DEFAULT_CHAT_ID ? [process.env.TELEGRAM_DEFAULT_CHAT_ID] : []),
  ]);

  return sendToChats(token, [...chatIds], message, "Telegram weekly report failed");
}

export async function sendTelegramStartMessage(chatId: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: 0, failed: 0, reason: "token_missing" as const };

  const message = [
    "👋 <b>Team Kanban Board</b>",
    "",
    "Создайте новую задачу прямо из Telegram — она сразу появится на доске сайта.",
  ].join("\n");

  return sendToChats(token, [chatId], message, "Telegram /start response failed");
}

export async function notifyTelegram(event: TelegramEvent, message: string, userIds: string[] = []) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const connections = userIds.length
    ? await prisma.telegramConnection.findMany({
        where: { enabled: true, userId: { in: userIds } },
      })
    : [];

  const chatIds = new Set([
    ...connections.map((connection) => connection.chatId),
    ...(process.env.TELEGRAM_DEFAULT_CHAT_ID ? [process.env.TELEGRAM_DEFAULT_CHAT_ID] : []),
  ]);

  await sendToChats(token, [...chatIds], formatTelegramMessage(event, message), "Telegram notification failed");
}

async function sendToChats(token: string, chatIds: string[], text: string, errorLabel: string) {
  const taskUrl = `${(process.env.APP_URL ?? "https://kanban.region-free.online").replace(/\/$/, "")}/telegram/new-task`;
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
              inline_keyboard: [[{ text: "➕ Создать задачу", url: taskUrl }]],
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
  const { taskTitle, body } = extractTaskTitle(message);
  return [
    `${icons[event]} <b>${escapeHtml(titles[event])}</b>`,
    "━━━━━━━━━━━━━━",
    taskTitle ? `<b>Название задачи:</b>\n<u><b>${escapeHtml(taskTitle)}</b></u>` : null,
    body ? escapeHtml(body) : null,
    "",
    "<i>Team Kanban Board</i>",
  ]
    .filter((line) => line !== null)
    .join("\n");
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
