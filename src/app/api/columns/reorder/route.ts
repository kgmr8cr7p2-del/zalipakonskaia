import { requireVerifiedUser } from "@/lib/auth";
import { canManageColumns } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { fail, handleRouteError, ok } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const body = (await request.json()) as { boardId?: unknown; orderedIds?: unknown };
    const boardId = typeof body.boardId === "string" ? body.boardId : "";
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.filter((id): id is string => typeof id === "string") : [];
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: { columns: { select: { id: true } } },
    });
    if (!board || (board.ownerId ? board.ownerId !== user.id : !canManageColumns(user))) {
      return fail("Недостаточно прав для изменения порядка колонок", 403);
    }

    const currentIds = board.columns.map((column) => column.id);
    const currentSet = new Set(currentIds);
    if (orderedIds.length !== currentIds.length || orderedIds.some((id) => !currentSet.has(id)) || new Set(orderedIds).size !== orderedIds.length) {
      return fail("Некорректный порядок колонок", 400);
    }

    await prisma.$transaction(async (tx) => {
      await Promise.all(orderedIds.map((id, index) => tx.column.update({ where: { id }, data: { position: index + 1000 } })));
      await Promise.all(orderedIds.map((id, index) => tx.column.update({ where: { id }, data: { position: index } })));
    });
    if (!board.ownerId) {
      await logActivity({ action: "COLUMN_CHANGED", userId: user.id, details: { action: "reordered", orderedIds } });
    }
    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
