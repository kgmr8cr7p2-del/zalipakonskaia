import path from "node:path";
import { rm } from "node:fs/promises";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleRouteError, ok } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const board = await prisma.board.findFirst({ where: { id, ownerId: user.id }, select: { id: true } });
    if (!board) return fail("Личная доска не найдена", 404);
    const tasks = await prisma.task.findMany({ where: { column: { boardId: id } }, select: { id: true } });
    await prisma.$transaction([
      prisma.task.deleteMany({ where: { id: { in: tasks.map((task) => task.id) } } }),
      prisma.board.delete({ where: { id } }),
    ]);
    await Promise.all(tasks.map((task) => rm(path.join(process.cwd(), "uploads", task.id), { recursive: true, force: true }).catch(() => undefined)));
    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
