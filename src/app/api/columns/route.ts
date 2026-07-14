import { requireVerifiedUser } from "@/lib/auth";
import { canManageColumns } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { columnSchema } from "@/lib/validators";
import { fail, handleRouteError, ok } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const body = await request.json();
    const input = columnSchema.parse(body);
    const boardId = typeof body.boardId === "string" ? body.boardId : "";
    const board = await prisma.board.findUnique({ where: { id: boardId }, include: { columns: true } });
    if (!board || (board.ownerId ? board.ownerId !== user.id : !canManageColumns(user))) {
      return fail("Недостаточно прав для изменения колонок этой доски", 403);
    }

    const column = await prisma.column.create({
      data: { name: input.name, boardId: board.id, position: board.columns.length },
    });
    if (!board.ownerId) {
      await logActivity({
        action: "COLUMN_CHANGED",
        userId: user.id,
        details: { columnId: column.id, name: column.name, action: "created" },
      });
    }
    return ok({ column });
  } catch (error) {
    return handleRouteError(error);
  }
}
