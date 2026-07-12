import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWeeklyReport } from "@/lib/weekly-report";
import { sendWeeklyReportMessage } from "@/lib/telegram";
import { handleRouteError, ok } from "@/lib/http";

function formatReport(report: Awaited<ReturnType<typeof getWeeklyReport>>) {
  const lines: string[] = [
    "📊 <b>Еженедельный отчёт</b>",
    `📅 ${formatDate(report.period.from)} — ${formatDate(report.period.to)}`,
    "",
    "<b>Итоги недели</b>",
    `🟣 Создано: <b>${report.totals.createdThisWeek}</b>   ·   ✅ Выполнено: <b>${report.totals.completedThisWeek}</b>`,
    `🔧 В работе: <b>${report.totals.inProgress}</b>   ·   👀 На проверке: <b>${report.totals.inReview}</b>`,
    `🔴 Просрочено: <b>${report.totals.overdue}</b>   ·   ⚠️ Критических: <b>${report.totals.critical}</b>`,
    `📋 Активных: <b>${report.totals.active}</b>   ·   📦 Всего: <b>${report.totals.total}</b>`,
    "",
    "<b>Активность команды</b>",
    `💬 Комментарии: <b>${report.totals.commentsAdded}</b>   ·   📎 Файлы: <b>${report.totals.filesUploaded}</b>`,
    `☑️ Чек-листы: <b>${report.totals.checklistChanges}</b>   ·   🔁 Смены статуса: <b>${report.totals.statusChanges}</b>`,
  ];
  lines.push("", "<i>Team Kanban Board · автоотчёт</i>");
  return lines.join("\n");
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

export async function POST(request: Request) {
  let dispatchKey = "";
  try {
    await authorizeRequest(request);
    const report = await getWeeklyReport();
    const immediate = new URL(request.url).searchParams.get("force") === "1";
    const dateKey = moscowDateKey(new Date());
    // The immediate first run also satisfies this week's scheduled delivery.
    // A single date key prevents the scheduler from sending a duplicate later.
    dispatchKey = `weekly-report-${dateKey}`;

    try {
      await prisma.notificationDispatch.create({
        data: {
          key: dispatchKey,
          type: immediate ? "weekly_report_immediate" : "weekly_report_scheduled",
          payload: report.totals,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return ok({ report, sent: false, duplicate: true });
      }
      throw error;
    }

    const message = formatReport(report);
    const delivery = await sendWeeklyReportMessage(message);
    if (!delivery.sent) {
      const reason = "reason" in delivery ? delivery.reason : "delivery_failed";
      throw new Error(`Telegram report was not delivered: ${reason}`);
    }
    return ok({ report, sent: true, delivery });
  } catch (error) {
    if (dispatchKey) await prisma.notificationDispatch.deleteMany({ where: { key: dispatchKey } }).catch(() => undefined);
    return handleRouteError(error);
  }
}

async function authorizeRequest(request: Request) {
  const expected = process.env.SESSION_SECRET ?? "";
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (expected && received && secureEqual(expected, received)) return;
  await requireVerifiedUser();
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function moscowDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
