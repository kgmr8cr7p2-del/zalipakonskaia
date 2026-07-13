import { ActivityAction } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditTask } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { fail, handleRouteError, ok } from "@/lib/http";
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
    const body = await request.json();
    const checklist = await prisma.checklist.create({
      data: { title: String(body.title || "Чек-лист"), taskId: id },
      include: { items: true },
    });
    await logActivity({ action: ActivityAction.CHECKLIST_CHANGED, userId: user.id, taskId: id, details: { title: checklist.title } });
    return ok({ checklist });
  } catch (error) {
    return handleRouteError(error);
  }
}
