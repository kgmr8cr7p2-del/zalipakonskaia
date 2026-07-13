import { RoleName } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { columnSchema } from "@/lib/validators";
import { handleRouteError, ok } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const user = await requireRole([RoleName.ADMIN]);
    const input = columnSchema.parse(await request.json());
    const board = await prisma.board.findFirstOrThrow({ where: { ownerId: null }, include: { columns: true } });
    const column = await prisma.column.create({
      data: {
        name: input.name,
        boardId: board.id,
        position: board.columns.length,
      },
    });
    await logActivity({
      action: "COLUMN_CHANGED",
      userId: user.id,
      details: { columnId: column.id, name: column.name, action: "created" },
    });
    return ok({ column });
  } catch (error) {
    return handleRouteError(error);
  }
}
