import { ActivityAction } from "@prisma/client";
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

const priorityLabels = {
  LOW: "Низкая",
  MEDIUM: "Средняя",
  HIGH: "Высокая",
  CRITICAL: "Критическая",
};

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const input = taskSchema.parse(await request.json());
    const targetColumn = await getAccessibleColumn(user.id, input.columnId);
    if (!targetColumn) return fail("Колонка не найдена", 404);
    const isPersonalBoard = targetColumn.board.ownerId === user.id;
    if (!isPersonalBoard && !canCreateTask(user)) return fail("Недостаточно прав для создания задачи", 403);
    if (isPersonalBoard && input.assigneeId && input.assigneeId !== user.id) return fail("На личной доске задачу можно назначить только себе", 403);
    const maxPosition = await prisma.task.aggregate({
      where: { columnId: input.columnId },
      _max: { position: true },
    });

    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        deadline: input.deadline ? new Date(input.deadline) : null,
        columnId: input.columnId,
        oilDepotId: input.oilDepotId || null,
        authorId: user.id,
        assigneeId: input.assigneeId || null,
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
    if (!isPersonalBoard) {
      await notifyTelegram(
        "task_created",
        formatTaskCreatedMessage(taskWithDetails, user, initialComment),
        taskWithDetails.assigneeId ? [taskWithDetails.assigneeId] : [],
      );
      triggerTaskSoundEvent();
    }
    return ok({ task: taskWithDetails });
  } catch (error) {
    return handleRouteError(error);
  }
}

function formatTaskCreatedMessage(task: Awaited<ReturnType<typeof prisma.task.findUniqueOrThrow>>, user: { name: string; email: string }, comment?: string) {
  const deadline = task.deadline ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(task.deadline) : "не указан";
  const oilDepotName = (task as any).oilDepot?.name ?? "не указана";
  return [
    `Задача #${(task as any).taskNumber}`,
    `Нефтебаза: ${oilDepotName}`,
    `Задача: ${task.title}`,
    `Создал: ${user.name} (${user.email})`,
    `Важность: ${priorityLabels[task.priority as keyof typeof priorityLabels]}`,
    `Срок: ${deadline}`,
    `Комментарий: ${comment?.trim() || "нет"}`,
  ].join("\n");
}
