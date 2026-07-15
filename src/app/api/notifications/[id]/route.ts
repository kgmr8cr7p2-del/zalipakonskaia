import { requireVerifiedUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const item = await prisma.notification.updateMany({ where: { id, userId: user.id }, data: { readAt: new Date() } });
    if (!item.count) return fail("Уведомление не найдено", 404);
    return ok({});
  } catch (error) {
    return handleRouteError(error);
  }
}
