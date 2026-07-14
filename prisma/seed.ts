import { PermissionKey, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const allPermissions = Object.values(PermissionKey);
  await Promise.all([
    prisma.role.upsert({
      where: { systemKey: "ADMIN" },
      update: { name: "Администратор", permissions: allPermissions },
      create: { name: "Администратор", systemKey: "ADMIN", permissions: allPermissions },
    }),
    prisma.role.upsert({
      where: { systemKey: "MANAGER" },
      update: {},
      create: {
        name: "Менеджер",
        systemKey: "MANAGER",
        permissions: [PermissionKey.VIEW_BOARD, PermissionKey.CREATE_TASKS, PermissionKey.EDIT_ALL_TASKS, PermissionKey.VIEW_REPORTS, PermissionKey.VIEW_HISTORY, PermissionKey.USE_CHATS, PermissionKey.USE_TELEGRAM],
      },
    }),
    prisma.role.upsert({
      where: { systemKey: "EXECUTOR" },
      update: {},
      create: {
        name: "Исполнитель",
        systemKey: "EXECUTOR",
        permissions: [PermissionKey.VIEW_BOARD, PermissionKey.VIEW_REPORTS, PermissionKey.VIEW_HISTORY, PermissionKey.USE_CHATS, PermissionKey.USE_TELEGRAM],
      },
    }),
  ]);

  const board = await prisma.board.upsert({
    where: { id: "default-board" },
    update: { name: "Taskora" },
    create: { id: "default-board", name: "Taskora" },
  });

  await prisma.oilDepot.upsert({
    where: { id: "default-oil-depot" },
    update: { name: "Не указана", active: true },
    create: { id: "default-oil-depot", name: "Не указана", active: true },
  });

  const columnNames = ["Новые", "В работе", "На проверке", "Готово"];
  for (const [index, name] of columnNames.entries()) {
    await prisma.column.upsert({
      where: { boardId_position: { boardId: board.id, position: index } },
      update: { name },
      create: { name, position: index, boardId: board.id },
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
