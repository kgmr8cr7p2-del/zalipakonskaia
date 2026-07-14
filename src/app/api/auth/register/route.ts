import { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { AuthCodeCooldownError, issueVerificationCode } from "@/lib/email-auth";
import { fail, handleRouteError, ok } from "@/lib/http";
import { assertMailConfigured, MailDeliveryError } from "@/lib/mail";
import { registerSchema } from "@/lib/validators";
import { formatUserName } from "@/lib/user-name";

export async function POST(request: Request) {
  try {
    assertMailConfigured();
    const input = registerSchema.parse(await request.json());
    const invite = await prisma.userInvite.findUnique({
      where: { email: input.email },
      include: { role: true },
    });

    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists?.emailVerifiedAt) return fail("Пользователь с такой почтой уже существует", 409);

    const roleName = invite?.role.name ?? RoleName.EXECUTOR;
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const accountData = {
      name: formatUserName(input),
      lastName: input.lastName,
      firstName: input.firstName,
      middleName: input.middleName,
      passwordHash: await hashPassword(input.password),
      roleId: role.id,
      approvedAt: null,
    };
    const user = exists
      ? await prisma.user.update({ where: { id: exists.id }, data: accountData })
      : await prisma.user.create({ data: { ...accountData, email: input.email } });

    await issueVerificationCode(user.id, user.email);
    return ok({ ok: true, verified: false, email: user.email });
  } catch (error) {
    if (error instanceof AuthCodeCooldownError) return fail(error.message, 429);
    if (error instanceof MailDeliveryError) return fail(error.message, 503);
    return handleRouteError(error);
  }
}
