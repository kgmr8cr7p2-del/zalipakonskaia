import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleRouteError, ok } from "@/lib/http";
import { userAdminUpdateSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const actor = await requirePermission(PermissionKey.MANAGE_USERS);
    const { id } = await params;
    const input = userAdminUpdateSchema.parse(await request.json());
    const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!target) return fail("Пользователь не найден", 404);
    const nextRole = input.roleId ? await prisma.role.findUnique({ where: { id: input.roleId } }) : null;
    if (input.roleId && !nextRole) return fail("Роль не найдена", 404);
    if (id === actor.id && (input.approved === false || (nextRole && !nextRole.permissions.includes(PermissionKey.MANAGE_USERS)))) {
      return fail("Нельзя отозвать собственный административный доступ", 422);
    }
    if (input.approved === true && !target.emailVerifiedAt) {
      return fail("Сначала пользователь должен подтвердить почту", 422);
    }

    const removesAdminAccess = target.role.permissions.includes(PermissionKey.MANAGE_USERS)
      && (input.approved === false || (nextRole !== null && !nextRole.permissions.includes(PermissionKey.MANAGE_USERS)));
    if (removesAdminAccess) {
      const activeAdmins = await prisma.user.count({
        where: { approvedAt: { not: null }, role: { permissions: { has: PermissionKey.MANAGE_USERS } } },
      });
      if (activeAdmins <= 1) return fail("Нельзя отключить последнего активного администратора", 422);
    }

    const data: { roleId?: string; approvedAt?: Date | null } = {};
    if (nextRole) data.roleId = nextRole.id;
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
