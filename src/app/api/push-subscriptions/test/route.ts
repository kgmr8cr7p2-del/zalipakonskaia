import { requireVerifiedUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/http";
import { sendWebPushNotification } from "@/lib/web-push";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса", 403);
    const result = await sendWebPushNotification(user.id, {
      id: `test-${Date.now()}`,
      title: "Taskora · Проверка уведомлений",
      body: "Системные уведомления работают. Новые сообщения и упоминания будут появляться здесь.",
      href: "/notifications",
    });
    if (!result.sent) return fail("Активная браузерная подписка не найдена. Переподключите push-уведомления.", 409);
    return ok({ sent: result.sent });
  } catch (error) {
    return handleRouteError(error);
  }
}

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}
