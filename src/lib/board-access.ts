import { PermissionKey, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/role-permissions";

export function accessibleBoardWhere(user: CurrentUser): Prisma.BoardWhereInput {
  if (!hasPermission(user, PermissionKey.VIEW_BOARD)) return { id: "__no_board_access__" };
  return { OR: [{ ownerId: null }, { ownerId: user.id }] };
}

export async function getAccessibleColumn(user: CurrentUser, columnId: string) {
  return prisma.column.findFirst({
    where: { id: columnId, board: accessibleBoardWhere(user) },
    include: { board: { select: { id: true, ownerId: true } } },
  });
}

export async function canAccessTask(user: CurrentUser, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, column: { board: accessibleBoardWhere(user) } },
    select: { id: true, column: { select: { boardId: true, board: { select: { ownerId: true } } } } },
  });
  return task;
}
