import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPersonalTaskReminder, sendSharedTaskReminder } from "@/lib/telegram";
import { handleRouteError, ok } from "@/lib/http";

export async function POST(request: Request) {
  try {
    await authorizeRequest(request);
    const now = new Date();
    const tasks = await prisma.task.findMany({
      where: {
        archivedAt: null,
        deadline: { not: null },
        reminderDaysBefore: { not: null },
      },
      select: {
        id: true,
        taskNumber: true,
        title: true,
        priority: true,
        deadline: true,
        reminderDaysBefore: true,
        column: { select: { name: true, board: { select: { id: true, name: true, ownerId: true } } } },
      },
      take: 1000,
    });

    const due = tasks.filter((task) => {
      if (task.priority === "PLANNED" || !task.deadline || task.reminderDaysBefore == null || isClosedColumn(task.column.name)) return false;
      return reminderAt(task.deadline, task.reminderDaysBefore) <= now && deadlineEnd(task.deadline) >= now;
    });

    let sent = 0;
    let failed = 0;
    let duplicate = 0;
    for (const task of due) {
      const result = await dispatchReminder(task);
      if (result === "sent") sent += 1;
      else if (result === "duplicate") duplicate += 1;
      else failed += 1;
    }

    return ok({ checked: tasks.length, due: due.length, sent, failed, duplicate });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function dispatchReminder(task: {
  id: string;
  taskNumber: number;
  title: string;
  priority: string;
  deadline: Date | null;
  reminderDaysBefore: number | null;
  column: { name: string; board: { id: string; name: string; ownerId: string | null } };
}) {
  if (task.priority === "PLANNED" || !task.deadline || task.reminderDaysBefore == null) return "failed" as const;
  const deadlineKey = task.deadline.toISOString().slice(0, 10);
  const dispatchKey = `task-reminder:${task.id}:${deadlineKey}:${task.reminderDaysBefore}`;

  try {
    await prisma.notificationDispatch.create({
      data: {
        key: dispatchKey,
        type: task.column.board.ownerId ? "personal_task_reminder" : "shared_task_reminder",
        payload: { taskId: task.id, deadline: deadlineKey, daysBefore: task.reminderDaysBefore },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "duplicate" as const;
    throw error;
  }

  const message = [
    `Задача: #${task.taskNumber} ${task.title}`,
    `Доска: ${task.column.board.name}`,
    `Срок: ${new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "Europe/Moscow" }).format(task.deadline)}`,
    task.reminderDaysBefore === 0 ? "Напоминание: срок сегодня" : `Напоминание: за ${daysLabel(task.reminderDaysBefore)} до срока`,
  ].join("\n");

  const delivery = task.column.board.ownerId
    ? await sendPersonalTaskReminder(task.column.board.ownerId, message)
    : await sendSharedTaskReminder(message);
  if (delivery.sent > 0) return "sent" as const;

  await prisma.notificationDispatch.deleteMany({ where: { key: dispatchKey } }).catch(() => undefined);
  return "failed" as const;
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

function reminderAt(deadline: Date, daysBefore: number) {
  return new Date(Date.UTC(
    deadline.getUTCFullYear(),
    deadline.getUTCMonth(),
    deadline.getUTCDate() - daysBefore,
    6,
  ));
}

function deadlineEnd(deadline: Date) {
  return new Date(Date.UTC(
    deadline.getUTCFullYear(),
    deadline.getUTCMonth(),
    deadline.getUTCDate() + 1,
    -3,
  ) - 1);
}

function isClosedColumn(name: string) {
  const normalized = name.toLocaleLowerCase("ru-RU");
  return normalized.includes("готов") || normalized.includes("провер") || normalized.includes("done") || normalized.includes("complete") || normalized.includes("review");
}

function daysLabel(days: number) {
  if (days % 10 === 1 && days % 100 !== 11) return `${days} день`;
  if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) return `${days} дня`;
  return `${days} дней`;
}
