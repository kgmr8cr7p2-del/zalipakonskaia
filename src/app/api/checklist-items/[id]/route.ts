import { ActivityAction } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditTask } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { fail, handleRouteError, ok } from "@/lib/http";
import { canAccessTask } from "@/lib/board-access";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const existing = await prisma.checklistItem.findUnique({
      where: { id },
      include: { checklist: { include: { task: true } } },
    });
    if (!existing) return fail("Пункт не найден", 404);
    const access = await canAccessTask(user.id, existing.checklist.taskId);
    if (!access) return fail("Пункт не найден", 404);
    if (access.column.board.ownerId !== user.id && !canEditTask(user, existing.checklist.task)) return fail("Недостаточно прав", 403);
    const body = await request.json();
    const item = await prisma.checklistItem.update({
      where: { id },
      data: {
        text: typeof body.text === "string" ? body.text : undefined,
        completed: typeof body.completed === "boolean" ? body.completed : undefined,
      },
    });
    await logActivity({
      action: ActivityAction.CHECKLIST_CHANGED,
      userId: user.id,
      taskId: existing.checklist.taskId,
      details: { item: item.text, completed: item.completed },
    });
    return ok({ item });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const existing = await prisma.checklistItem.findUnique({
      where: { id },
      include: { checklist: { include: { task: true } } },
    });
    if (!existing) return fail("Пункт не найден", 404);
    const access = await canAccessTask(user.id, existing.checklist.taskId);
    if (!access) return fail("Пункт не найден", 404);
    if (access.column.board.ownerId !== user.id && !canEditTask(user, existing.checklist.task)) return fail("Недостаточно прав", 403);
    await prisma.checklistItem.delete({ where: { id } });
    await logActivity({
      action: ActivityAction.CHECKLIST_CHANGED,
      userId: user.id,
      taskId: existing.checklist.taskId,
      details: { item: existing.text, action: "deleted" },
    });
    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
