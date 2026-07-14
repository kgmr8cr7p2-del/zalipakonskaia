import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDeleteComment } from "@/lib/permissions";
import { fail, handleRouteError, ok } from "@/lib/http";
import { canAccessTask } from "@/lib/board-access";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) return fail("Комментарий не найден", 404);
    if (!(await canAccessTask(user, comment.taskId))) return fail("Комментарий не найден", 404);
    if (!canDeleteComment(user, comment.authorId)) return fail("Недостаточно прав", 403);
    await prisma.comment.delete({ where: { id } });
    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
