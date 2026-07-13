import { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canRegisterEmail, createSession, hashPassword } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/http";
import { registerSchema } from "@/lib/validators";
import { formatUserName } from "@/lib/user-name";

const DEFAULT_TELEGRAM_CHAT_ID = "-5575713442";

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json());
    const invite = await prisma.userInvite.findUnique({
      where: { email: input.email },
      include: { role: true },
    });

    if (!invite && !canRegisterEmail(input.email)) {
      return fail("Эта почта не входит в список разрешённых адресов", 403);
    }

    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) return fail("Пользователь с такой почтой уже существует", 409);

    const roleName = invite?.role.name ?? RoleName.EXECUTOR;
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const user = await prisma.user.create({
      data: {
        name: formatUserName(input),
        lastName: input.lastName,
        firstName: input.firstName,
        middleName: input.middleName,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        roleId: role.id,
        emailVerifiedAt: new Date(),
        telegramConnection: {
          create: { chatId: DEFAULT_TELEGRAM_CHAT_ID },
        },
      },
    });

    if (invite) {
      await prisma.userInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    }

    await createSession(user.id);
    return ok({ ok: true, verified: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
