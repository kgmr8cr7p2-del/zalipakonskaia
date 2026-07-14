import { ActivityAction } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditTask } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { notifyTelegram } from "@/lib/telegram";
import { fail, handleRouteError, ok } from "@/lib/http";
import { commentSchema } from "@/lib/validators";
import { canAccessTask } from "@/lib/board-access";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const access = await canAccessTask(user.id, id);
    if (!access) return fail("Задача не найдена", 404);
    const task = await prisma.task.findUnique({ where: { id }, include: { assignees: { select: { userId: true } } } });
    if (!task) return fail("Задача не найдена", 404);
    if (access.column.board.ownerId !== user.id && !canEditTask(user, task)) return fail("Недостаточно прав", 403);
    const input = commentSchema.parse(await request.json());
    const comment = await prisma.comment.create({
      data: { text: input.text, taskId: id, authorId: user.id },
      include: {
        author: {
          select: { id: true, name: true, email: true, jobTitle: true, handle: true, profileStatus: true, currentActivity: true, lastActiveAt: true, avatarUrl: true },
        },
      },
    });
    await logActivity({
      action: ActivityAction.COMMENT_ADDED,
      userId: user.id,
      taskId: id,
      details: { text: input.text.slice(0, 120) },
    });
    if (!access.column.board.ownerId && task.priority !== "PLANNED") await notifyTelegram("comment_added", [
      `Задача: ${task.title}`,
      `Автор: ${user.name}`,
      `Комментарий: ${input.text.slice(0, 260)}`,
    ].join("\n"), task.assignees.map((item) => item.userId));
    return ok({ comment });
  } catch (error) {
    return handleRouteError(error);
  }
}
