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
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return fail("Задача не найдена", 404);
    if (access.column.board.ownerId !== user.id && !canEditTask(user, task)) return fail("Недостаточно прав", 403);
    const input = commentSchema.parse(await request.json());
    const comment = await prisma.comment.create({
      data: { text: input.text, taskId: id, authorId: user.id },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    await logActivity({
      action: ActivityAction.COMMENT_ADDED,
      userId: user.id,
      taskId: id,
      details: { text: input.text.slice(0, 120) },
    });
    if (!access.column.board.ownerId) await notifyTelegram("comment_added", `${task.title}: ${input.text.slice(0, 180)}`, task.assigneeId ? [task.assigneeId] : []);
    return ok({ comment });
  } catch (error) {
    return handleRouteError(error);
  }
}
