import { prisma } from "@/lib/prisma";
import { AUTH_CODE_MAX_ATTEMPTS, authCodeMatches } from "@/lib/auth-code";
import { createSession } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/http";
import { notifyTelegram } from "@/lib/telegram";
import { verifyEmailCodeSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const input = verifyEmailCodeSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || user.emailVerifiedAt) return fail("Код недействителен", 422);

    const token = await prisma.emailVerificationToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (!token || token.expiresAt < new Date()) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      return fail("Срок действия кода истёк. Запросите новый код.", 410);
    }
    if (token.attempts >= AUTH_CODE_MAX_ATTEMPTS) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      return fail("Слишком много попыток. Запросите новый код.", 429);
    }
    if (!authCodeMatches(token.tokenHash, input.code, user.email, "verify-email")) {
      const attempts = token.attempts + 1;
      if (attempts >= AUTH_CODE_MAX_ATTEMPTS) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
        return fail("Слишком много попыток. Запросите новый код.", 429);
      }
      await prisma.emailVerificationToken.update({ where: { id: token.id }, data: { attempts } });
      return fail(`Неверный код. Осталось попыток: ${AUTH_CODE_MAX_ATTEMPTS - attempts}.`, 422);
    }

    const [verifiedUser] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } }),
      prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
      prisma.userInvite.updateMany({ where: { email: user.email }, data: { acceptedAt: new Date() } }),
    ]);
    await createSession(user.id);
    await notifyTelegram("account_registered", `Пользователь: ${user.name}\nПочта: ${user.email}`);
    return ok({ ok: true, verified: true, approved: Boolean(verifiedUser.approvedAt) });
  } catch (error) {
    return handleRouteError(error);
  }
}
