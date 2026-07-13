import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function accessibleBoardWhere(userId: string): Prisma.BoardWhereInput {
  return { OR: [{ ownerId: null }, { ownerId: userId }] };
}

export async function getAccessibleColumn(userId: string, columnId: string) {
  return prisma.column.findFirst({
    where: { id: columnId, board: accessibleBoardWhere(userId) },
    include: { board: { select: { id: true, ownerId: true } } },
  });
}

export async function canAccessTask(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, column: { board: accessibleBoardWhere(userId) } },
    select: { id: true, column: { select: { boardId: true, board: { select: { ownerId: true } } } } },
  });
  return task;
}
