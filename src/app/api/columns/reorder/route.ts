import { RoleName } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { fail, handleRouteError, ok } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const user = await requireRole([RoleName.ADMIN]);
    const body = (await request.json()) as { orderedIds?: unknown };
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.filter((id): id is string => typeof id === "string") : [];
    const board = await prisma.board.findFirstOrThrow({
      where: { ownerId: null },
      include: { columns: { select: { id: true } } },
    });
    const currentIds = board.columns.map((column) => column.id);
    const currentSet = new Set(currentIds);

    if (orderedIds.length !== currentIds.length || orderedIds.some((id) => !currentSet.has(id)) || new Set(orderedIds).size !== orderedIds.length) {
      return fail("Некорректный порядок колонок", 400);
    }

    await prisma.$transaction(async (tx) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          tx.column.update({
            where: { id },
            data: { position: index + 1000 },
          }),
        ),
      );
      await Promise.all(
        orderedIds.map((id, index) =>
          tx.column.update({
            where: { id },
            data: { position: index },
          }),
        ),
      );
      await logActivity({
        action: "COLUMN_CHANGED",
        userId: user.id,
        details: { action: "reordered", orderedIds },
      });
    });

    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
