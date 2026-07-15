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

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса", 403);
    const { id } = await params;
    const result = await prisma.notification.deleteMany({ where: { id, userId: user.id } });
    if (!result.count) return fail("Уведомление не найдено", 404);
    return ok({});
  } catch (error) {
    return handleRouteError(error);
  }
}

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}
