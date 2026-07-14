import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";
import { AuthCodeCooldownError, issueVerificationCode } from "@/lib/email-auth";
import { fail, handleRouteError, ok } from "@/lib/http";
import { MailDeliveryError } from "@/lib/mail";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { role: true },
    });

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      return fail("Неверная почта или пароль", 401);
    }

    if (!user.emailVerifiedAt) {
      try {
        await issueVerificationCode(user.id, user.email);
      } catch (error) {
        if (!(error instanceof AuthCodeCooldownError)) throw error;
      }
      return ok({ ok: true, verified: false, email: user.email });
    }

    await createSession(user.id);
    return ok({ ok: true, verified: true, approved: Boolean(user.approvedAt) });
  } catch (error) {
    if (error instanceof MailDeliveryError) return fail(error.message, 503);
    return handleRouteError(error);
  }
}
