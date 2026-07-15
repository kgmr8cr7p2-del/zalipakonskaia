import { requireVerifiedUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const params = new URL(request.url).searchParams;
    const limit = Math.min(Math.max(Number(params.get("limit") || 30), 1), 100);
    const unreadOnly = params.get("unread") === "1";
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id, readAt: unreadOnly ? null : undefined },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return ok({ notifications: items, unreadCount });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const body = await request.json().catch(() => ({}));
    if (body?.action !== "read-all") return fail("Неизвестное действие", 400);
    await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return ok({});
  } catch (error) {
    return handleRouteError(error);
  }
}
