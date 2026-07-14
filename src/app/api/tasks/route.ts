import { ActivityAction, Prisma } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { taskInclude } from "@/lib/board-data";
import { canCreateTask } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { notifyTelegram } from "@/lib/telegram";
import { fail, handleRouteError, ok } from "@/lib/http";
import { taskSchema } from "@/lib/validators";
import { tagConnects } from "@/lib/tags";
import { triggerTaskSoundEvent } from "@/lib/task-sound-event";
import { getAccessibleColumn } from "@/lib/board-access";
import { taskTitleKey } from "@/lib/task-title";

const priorityLabels = {
  LOW: "Низкая",
  PLANNED: "Плановые работы",
  MEDIUM: "Средняя",
  HIGH: "Высокая",
  CRITICAL: "Критическая",
};

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const input = taskSchema.parse(await request.json());
    const assigneeIds = Array.from(new Set(input.assigneeIds?.length ? input.assigneeIds : input.assigneeId ? [input.assigneeId] : []));
    const targetColumn = await getAccessibleColumn(user, input.columnId);
    if (!targetColumn) return fail("Колонка не найдена", 404);
    const isPersonalBoard = targetColumn.board.ownerId === user.id;
    if (!isPersonalBoard && !canCreateTask(user)) return fail("Недостаточно прав для создания задачи", 403);
    if (isPersonalBoard && assigneeIds.some((id) => id !== user.id)) return fail("На личной доске задачу можно назначить только себе", 403);
    const titleKey = taskTitleKey(input.title);
    const duplicate = await prisma.task.findUnique({ where: { titleKey }, select: { id: true } });
    if (duplicate) return fail("Задача с таким названием уже существует. Укажите другое название.", 409);

    const createdAt = new Date();
    const startDate = input.startDate ? parseTaskDate(input.startDate) : createdAt;
    const deadline = parseTaskDate(input.deadline);
    if (dateKey(deadline) < dateKey(startDate)) return fail("Дедлайн не может быть раньше даты начала задачи.", 422);
    const reminderDaysBefore = input.reminderDaysBefore == null
      ? null
      : isPersonalBoard
        ? input.reminderDaysBefore
        : 1;
    const maxPosition = await prisma.task.aggregate({
      where: { columnId: input.columnId },
      _max: { position: true },
    });

    const task = await prisma.task.create({
      data: {
        title: input.title,
        titleKey,
        description: input.description,
        priority: input.priority,
        startDate,
        deadline,
        reminderDaysBefore,
        createdAt,
        columnId: input.columnId,
        oilDepotId: input.oilDepotId || null,
        authorId: user.id,
        assigneeId: assigneeIds[0] || null,
        assignees: assigneeIds.length ? { create: assigneeIds.map((userId) => ({ userId })) } : undefined,
        position: (maxPosition._max.position ?? -1) + 1,
        tags: { create: await tagConnects(input.tags) },
      },
      include: taskInclude,
    });
    const initialComment = input.initialComment?.trim();
    if (initialComment) {
      await prisma.comment.create({
        data: {
          taskId: task.id,
          authorId: user.id,
          text: initialComment,
        },
      });
    }
    const checklistItems = input.initialChecklist?.map((text) => text.trim()).filter(Boolean) ?? [];
    if (checklistItems.length) {
      await prisma.checklist.create({
        data: {
          taskId: task.id,
          title: "Чеклист",
          items: {
            create: checklistItems.map((text) => ({ text })),
          },
        },
      });
    }
    const taskWithDetails = await prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      include: taskInclude,
    });

    await logActivity({
      action: ActivityAction.TASK_CREATED,
      userId: user.id,
      taskId: task.id,
      details: { title: task.title },
    });
    if (!isPersonalBoard && input.priority !== "PLANNED") {
      await notifyTelegram(
        "task_created",
        formatTaskCreatedMessage(taskWithDetails, user, initialComment),
        assigneeIds,
      );
      triggerTaskSoundEvent();
    }
    return ok({ task: taskWithDetails });
  } catch (error) {
    if (isDuplicateTitleError(error)) return fail("Задача с таким названием уже существует. Укажите другое название.", 409);
    return handleRouteError(error);
  }
}

function formatTaskCreatedMessage(task: Awaited<ReturnType<typeof prisma.task.findUniqueOrThrow>>, user: { name: string; email: string }, comment?: string) {
  const startDate = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format((task as any).startDate);
  const deadline = task.deadline ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(task.deadline) : "не указан";
  const oilDepotName = (task as any).oilDepot?.name ?? "не указана";
  const assignees = (task as any).assignees?.map((item: any) => item.user.name).join(", ") || "не назначены";
  return [
    `Задача #${(task as any).taskNumber}`,
    `Задача: ${task.title}`,
    `Нефтебаза: ${oilDepotName}`,
    `Исполнители: ${assignees}`,
    `Создал: ${user.name} (${user.email})`,
    `Важность: ${priorityLabels[task.priority as keyof typeof priorityLabels]}`,
    `Начало: ${startDate}`,
    `Срок: ${deadline}`,
    `Комментарий: ${comment?.trim() || "нет"}`,
  ].join("\n");
}

function parseTaskDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isDuplicateTitleError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
