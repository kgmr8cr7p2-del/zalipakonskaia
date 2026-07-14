import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleRouteError, ok } from "@/lib/http";
import { userInviteSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    await requirePermission(PermissionKey.MANAGE_USERS);
    const input = userInviteSchema.parse(await request.json());
    const role = await prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role) return fail("Роль не найдена", 404);
    const existingUser = await prisma.user.findUnique({ where: { email: input.email }, include: { role: true } });

    if (existingUser) {
      return fail("Пользователь уже зарегистрирован. Измените его роль в списке пользователей.", 409);
    }

    const invite = await prisma.userInvite.upsert({
      where: { email: input.email },
      update: { roleId: role.id, acceptedAt: null },
      create: { email: input.email, roleId: role.id },
      include: { role: true },
    });

    return ok({ invite });
  } catch (error) {
    return handleRouteError(error);
  }
}
