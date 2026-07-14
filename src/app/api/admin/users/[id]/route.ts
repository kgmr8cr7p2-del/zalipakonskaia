import { RoleName } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleRouteError, ok } from "@/lib/http";
import { userAdminUpdateSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const actor = await requireRole([RoleName.ADMIN]);
    const { id } = await params;
    const input = userAdminUpdateSchema.parse(await request.json());
    const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!target) return fail("Пользователь не найден", 404);
    if (id === actor.id && (input.approved === false || (input.role && input.role !== RoleName.ADMIN))) {
      return fail("Нельзя отозвать собственный административный доступ", 422);
    }
    if (input.approved === true && !target.emailVerifiedAt) {
      return fail("Сначала пользователь должен подтвердить почту", 422);
    }

    const removesAdminAccess = target.role.name === RoleName.ADMIN
      && (input.approved === false || (input.role !== undefined && input.role !== RoleName.ADMIN));
    if (removesAdminAccess) {
      const activeAdmins = await prisma.user.count({
        where: { approvedAt: { not: null }, role: { name: RoleName.ADMIN } },
      });
      if (activeAdmins <= 1) return fail("Нельзя отключить последнего активного администратора", 422);
    }

    const data: { roleId?: string; approvedAt?: Date | null } = {};
    if (input.role) {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: input.role } });
      data.roleId = role.id;
    }
    if (input.approved !== undefined) data.approvedAt = input.approved ? new Date() : null;

    const user = await prisma.user.update({
      where: { id },
      data,
      include: { role: true },
    });
    if (input.approved === false) {
      await prisma.telegramConnection.updateMany({ where: { userId: id }, data: { enabled: false } });
    }
    return ok({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
