import { ActivityAction } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { taskInclude } from "@/lib/board-data";
import { canEditTask } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { notifyTelegram } from "@/lib/telegram";
import { fail, handleRouteError, ok } from "@/lib/http";
import { triggerTaskCompletionSoundEvent } from "@/lib/task-sound-event";
import { canAccessTask, getAccessibleColumn } from "@/lib/board-access";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const body = await request.json();
    const columnId = String(body.columnId ?? "");
    const position = Number(body.position ?? 0);
    const access = await canAccessTask(user.id, id);
    if (!access) return fail("Задача не найдена", 404);
    const destinationColumn = await getAccessibleColumn(user.id, columnId);
    if (!destinationColumn) return fail("Колонка не найдена", 404);
    if (destinationColumn.boardId !== access.column.boardId) return fail("Нельзя перенести задачу на другую доску", 400);
    const existing = await prisma.task.findUnique({ where: { id }, include: { column: { select: { name: true } }, assignees: { select: { userId: true } } } });
    if (!existing) return fail("Задача не найдена", 404);
    const isPersonalBoard = access.column.board.ownerId === user.id;
    if (!isPersonalBoard && !canEditTask(user, existing)) return fail("Недостаточно прав", 403);

    const returnedFromReviewToWork = isReviewColumn(existing.column.name) && isWorkColumn(destinationColumn.name);
    const nextDeadline = returnedFromReviewToWork ? nextThursday() : undefined;

    const task = await prisma.task.update({
      where: { id },
      data: { columnId, position, deadline: nextDeadline },
      include: taskInclude,
    });

    await logActivity({
      action: ActivityAction.STATUS_CHANGED,
      userId: user.id,
      taskId: task.id,
      details: { column: task.column.name, returnedFromReviewToWork },
    });
    if (returnedFromReviewToWork) {
      await logActivity({
        action: ActivityAction.DEADLINE_CHANGED,
        userId: user.id,
        taskId: task.id,
        details: { deadline: nextDeadline?.toISOString(), reason: "returned_from_review" },
      });
    }
    if (!isPersonalBoard) await notifyTelegram("status_changed", `${task.title}: ${task.column.name}`, task.assignees.map((item) => item.userId));
    if (!isPersonalBoard && !isCompletedColumn(existing.column.name) && isCompletedColumn(destinationColumn.name)) {
      triggerTaskCompletionSoundEvent();
    }
    return ok({ task });
  } catch (error) {
    return handleRouteError(error);
  }
}

function isCompletedColumn(name: string) {
  const normalized = name.toLocaleLowerCase("ru-RU");
  return normalized.includes("готов") || normalized.includes("РіРѕС‚РѕРІ".toLocaleLowerCase("ru-RU")) || normalized.includes("done") || normalized.includes("complete");
}

function isReviewColumn(name: string) {
  const normalized = name.toLocaleLowerCase("ru-RU");
  return normalized.includes("провер") || normalized.includes("review") || normalized.includes("verify") || normalized.includes("approval") || normalized.includes("РїСЂРѕРІРµСЂ".toLocaleLowerCase("ru-RU"));
}

function isWorkColumn(name: string) {
  const normalized = name.toLocaleLowerCase("ru-RU");
  return normalized.includes("работ") || normalized.includes("progress") || normalized.includes("doing") || normalized.includes("Р°Р±РѕС‚".toLocaleLowerCase("ru-RU"));
}

function nextThursday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const thursday = 4;
  const daysUntilThursday = (thursday - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilThursday);
  return date;
}
