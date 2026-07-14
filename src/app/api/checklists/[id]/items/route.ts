import { ActivityAction } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditTask } from "@/lib/permissions";
import { checklistItemSchema } from "@/lib/validators";
import { logActivity } from "@/lib/activity";
import { fail, handleRouteError, ok } from "@/lib/http";
import { canAccessTask } from "@/lib/board-access";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const checklist = await prisma.checklist.findUnique({ where: { id }, include: { task: { include: { assignees: { select: { userId: true } } } } } });
    if (!checklist) return fail("Чек-лист не найден", 404);
    const access = await canAccessTask(user, checklist.taskId);
    if (!access) return fail("Чек-лист не найден", 404);
    if (access.column.board.ownerId !== user.id && !canEditTask(user, checklist.task)) return fail("Недостаточно прав", 403);
    const input = checklistItemSchema.parse(await request.json());
    const item = await prisma.checklistItem.create({
      data: { checklistId: id, text: input.text },
    });
    await logActivity({
      action: ActivityAction.CHECKLIST_CHANGED,
      userId: user.id,
      taskId: checklist.taskId,
      details: { item: item.text, action: "created" },
    });
    return ok({ item });
  } catch (error) {
    return handleRouteError(error);
  }
}
