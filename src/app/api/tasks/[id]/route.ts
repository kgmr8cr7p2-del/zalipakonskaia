import path from "node:path";
import { rm } from "node:fs/promises";
import { ActivityAction, Prisma } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { taskInclude, type TaskWithDetails } from "@/lib/board-data";
import { canDeleteTask, canEditTask } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { notifyTelegram } from "@/lib/telegram";
import { fail, handleRouteError, ok } from "@/lib/http";
import { taskSchema } from "@/lib/validators";
import { tagConnects } from "@/lib/tags";
import { triggerTaskCompletionSoundEvent } from "@/lib/task-sound-event";
import { canAccessTask, getAccessibleColumn } from "@/lib/board-access";
import { taskTitleKey } from "@/lib/task-title";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const access = await canAccessTask(user.id, id);
    if (!access) return fail("Задача не найдена", 404);
    const isPersonalBoard = access.column.board.ownerId === user.id;
    const existing = await prisma.task.findUnique({
      where: { id },
      include: {
        column: { select: { name: true } },
        oilDepot: { select: { name: true } },
        assignees: { include: { user: { select: { name: true } } } },
      },
    });
    if (!existing) return fail("Задача не найдена", 404);
    if (!isPersonalBoard && !canEditTask(user, existing)) return fail("Недостаточно прав", 403);

    const input = taskSchema.partial().parse(await request.json());
    const hasAssigneeUpdate = input.assigneeIds !== undefined || input.assigneeId !== undefined;
    const assigneeIds = hasAssigneeUpdate
      ? Array.from(new Set(input.assigneeIds?.length ? input.assigneeIds : input.assigneeId ? [input.assigneeId] : []))
      : undefined;
    if (input.columnId) {
      const targetColumn = await getAccessibleColumn(user.id, input.columnId);
      if (!targetColumn || targetColumn.boardId !== access.column.boardId) return fail("Нельзя перенести задачу на другую доску", 400);
    }
    if (isPersonalBoard && assigneeIds?.some((userId) => userId !== user.id)) return fail("На личной доске задачу можно назначить только себе", 403);
    if (input.title && input.title !== existing.title) {
      const duplicate = await prisma.task.findUnique({ where: { titleKey: taskTitleKey(input.title) }, select: { id: true } });
      if (duplicate && duplicate.id !== id) return fail("Задача с таким названием уже существует. Укажите другое название.", 409);
    }

    const nextStartDate = input.startDate === undefined
      ? existing.startDate
      : input.startDate
        ? parseTaskDate(input.startDate)
        : existing.createdAt;
    const nextDeadline = input.deadline === undefined ? existing.deadline : parseTaskDate(input.deadline);
    if (!nextDeadline) return fail("Укажите дедлайн задачи.", 422);
    if (dateKey(nextDeadline) < dateKey(nextStartDate)) return fail("Дедлайн не может быть раньше даты начала задачи.", 422);
    const reminderDaysBefore = input.reminderDaysBefore === undefined
      ? undefined
      : input.reminderDaysBefore == null
        ? null
        : isPersonalBoard
          ? input.reminderDaysBefore
          : 1;
    const changes: ActivityAction[] = [];
    if (input.title && input.title !== existing.title) changes.push(ActivityAction.TITLE_CHANGED);
    if (input.description !== undefined && input.description !== existing.description) changes.push(ActivityAction.DESCRIPTION_CHANGED);
    if (input.priority && input.priority !== existing.priority) changes.push(ActivityAction.PRIORITY_CHANGED);
    if (input.startDate !== undefined && dateKey(nextStartDate) !== dateKey(existing.startDate)) changes.push(ActivityAction.START_DATE_CHANGED);
    if (input.deadline !== undefined && dateKey(nextDeadline) !== (existing.deadline ? dateKey(existing.deadline) : null)) changes.push(ActivityAction.DEADLINE_CHANGED);
    if (input.columnId && input.columnId !== existing.columnId) changes.push(ActivityAction.STATUS_CHANGED);
    const oilDepotChanged = input.oilDepotId !== undefined && (input.oilDepotId || null) !== existing.oilDepotId;
    if (assigneeIds && !sameIds(assigneeIds, existing.assignees.map((item) => item.userId))) changes.push(ActivityAction.ASSIGNEE_CHANGED);

    if (input.tags) await prisma.taskTag.deleteMany({ where: { taskId: id } });

    const task = await prisma.task.update({
      where: { id },
      data: {
        title: input.title,
        titleKey: input.title && input.title !== existing.title ? taskTitleKey(input.title) : undefined,
        description: input.description,
        priority: input.priority,
        startDate: input.startDate === undefined ? undefined : nextStartDate,
        deadline: input.deadline === undefined ? undefined : nextDeadline,
        reminderDaysBefore,
        columnId: input.columnId,
        oilDepotId: input.oilDepotId === undefined ? undefined : input.oilDepotId || null,
        assigneeId: assigneeIds === undefined ? undefined : assigneeIds[0] || null,
        assignees: assigneeIds === undefined ? undefined : { deleteMany: {}, create: assigneeIds.map((userId) => ({ userId })) },
        tags: input.tags ? { create: await tagConnects(input.tags) } : undefined,
      },
      include: taskInclude,
    });

    await Promise.all(
      changes.map((action) =>
        logActivity({
          action,
          userId: user.id,
          taskId: task.id,
          details: changeDetails(action, existing, task),
        }),
      ),
    );
    if (oilDepotChanged) {
      await logActivity({
        action: ActivityAction.DESCRIPTION_CHANGED,
        userId: user.id,
        taskId: task.id,
        details: { field: "oilDepot", oldValue: existing.oilDepot?.name ?? null, newValue: task.oilDepot?.name ?? null },
      });
    }
    if (!isPersonalBoard && task.priority !== "PLANNED" && changes.includes(ActivityAction.STATUS_CHANGED)) {
      await notifyTelegram("status_changed", [
        `Задача: ${task.title}`,
        `Было: ${existing.column.name}`,
        `Стало: ${task.column.name}`,
        `Изменил: ${user.name}`,
      ].join("\n"), task.assignees.map((item) => item.userId));
      if (!isCompletedColumn(existing.column.name) && isCompletedColumn(task.column.name)) {
        triggerTaskCompletionSoundEvent();
      }
    }
    if (!isPersonalBoard && task.priority !== "PLANNED" && changes.includes(ActivityAction.ASSIGNEE_CHANGED)) {
      await notifyTelegram("assignee_changed", formatAssigneeChangedMessage(task, user), task.assignees.map((item) => item.userId));
    }
    return ok({ task });
  } catch (error) {
    if (isDuplicateTitleError(error)) return fail("Задача с таким названием уже существует. Укажите другое название.", 409);
    return handleRouteError(error);
  }
}

function changeDetails(action: ActivityAction, existing: any, task: TaskWithDetails) {
  if (action === ActivityAction.TITLE_CHANGED) return { label: "Название", oldValue: existing.title, newValue: task.title };
  if (action === ActivityAction.DESCRIPTION_CHANGED) return { label: "Описание", oldValue: summarize(existing.description), newValue: summarize(task.description) };
  if (action === ActivityAction.PRIORITY_CHANGED) return { label: "Приоритет", oldValue: existing.priority, newValue: task.priority };
  if (action === ActivityAction.START_DATE_CHANGED) return { label: "Начало работы", oldValue: existing.startDate?.toISOString() ?? null, newValue: task.startDate.toISOString() };
  if (action === ActivityAction.DEADLINE_CHANGED) return { label: "Срок", oldValue: existing.deadline?.toISOString() ?? null, newValue: task.deadline?.toISOString() ?? null };
  if (action === ActivityAction.STATUS_CHANGED) return { previousColumn: existing.column.name, column: task.column.name };
  if (action === ActivityAction.ASSIGNEE_CHANGED) return {
    assigneesBefore: existing.assignees.map((item: any) => item.user.name),
    assigneesAfter: task.assignees.map((item) => item.user.name),
  };
  return { title: task.title };
}

function summarize(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 140 ? `${normalized.slice(0, 137)}…` : normalized;
}

function formatAssigneeChangedMessage(task: TaskWithDetails, user: { name: string; email: string }) {
  const assignee = task.assignees.length
    ? task.assignees.map((item) => `${item.user.name} (${item.user.email})`).join(", ")
    : "не назначен";
  return [
    `Задача #${task.taskNumber}`,
    `Задача: ${task.title}`,
    `Исполнители: ${assignee}`,
    `Статус: ${task.column.name}`,
    `Срок: ${task.deadline ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(task.deadline) : "не указан"}`,
    `Изменил: ${user.name} (${user.email})`,
  ].join("\n");
}

function sameIds(left: string[], right: string[]) {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length && sortedLeft.every((id, index) => id === sortedRight[index]);
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

function isCompletedColumn(name: string) {
  const normalized = name.toLocaleLowerCase("ru-RU");
  return normalized.includes("готов") || normalized.includes("done") || normalized.includes("complete");
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const access = await canAccessTask(user.id, id);
    if (!access) return fail("Задача не найдена", 404);
    if (access.column.board.ownerId !== user.id && !canDeleteTask(user)) return fail("Удалять задачи общей доски может только администратор", 403);
    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        taskNumber: true,
        title: true,
        oilDepotId: true,
        oilDepot: { select: { name: true } },
      },
    });
    if (!task) return fail("Задача не найдена", 404);

    await prisma.task.delete({ where: { id } });
    await rm(path.join(process.cwd(), "uploads", id), { recursive: true, force: true }).catch(() => undefined);
    if (!access.column.board.ownerId) {
      await logActivity({
        action: ActivityAction.TASK_DELETED,
        userId: user.id,
        details: {
          taskId: task.id,
          taskNumber: task.taskNumber,
          title: task.title,
          oilDepotId: task.oilDepotId,
          oilDepotName: task.oilDepot?.name ?? null,
          deletedPermanently: true,
        },
      });
    }
    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
