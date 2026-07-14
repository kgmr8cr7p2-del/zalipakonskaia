import { requireVerifiedUser } from "@/lib/auth";
import { canManageColumns } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { columnSchema } from "@/lib/validators";
import { fail, handleRouteError, ok } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const existing = await prisma.column.findUnique({
      where: { id },
      select: { id: true, board: { select: { ownerId: true } } },
    });
    if (!existing) return fail("Колонка не найдена", 404);
    if (existing.board.ownerId ? existing.board.ownerId !== user.id : !canManageColumns(user)) {
      return fail("Недостаточно прав для изменения колонки", 403);
    }

    const body = await request.json();
    const data: { name?: string; position?: number } = {};
    if (typeof body.name === "string") data.name = columnSchema.parse({ name: body.name }).name;
    if (Number.isInteger(body.position)) data.position = body.position;
    const column = await prisma.column.update({ where: { id }, data });

    if (!existing.board.ownerId) {
      await logActivity({ action: "COLUMN_CHANGED", userId: user.id, details: { columnId: column.id, ...data } });
    }
    return ok({ column });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const existing = await prisma.column.findUnique({
      where: { id },
      select: { id: true, board: { select: { ownerId: true } } },
    });
    if (!existing) return fail("Колонка не найдена", 404);
    if (existing.board.ownerId ? existing.board.ownerId !== user.id : !canManageColumns(user)) {
      return fail("Недостаточно прав для удаления колонки", 403);
    }
    const taskCount = await prisma.task.count({ where: { columnId: id } });
    if (taskCount > 0) return fail("Нельзя удалить колонку, пока в ней есть задачи", 409);
    await prisma.column.delete({ where: { id } });
    if (!existing.board.ownerId) {
      await logActivity({ action: "COLUMN_CHANGED", userId: user.id, details: { columnId: id, action: "deleted" } });
    }
    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
