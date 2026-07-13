import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/telegram";
import { ok } from "@/lib/http";

export async function POST() {
  await requireVerifiedUser();
  const now = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const soon = await prisma.task.findMany({
    where: { deadline: { gte: now, lte: tomorrow }, assigneeId: { not: null }, column: { board: { ownerId: null } } },
    select: { title: true, deadline: true, assigneeId: true },
  });
  const overdue = await prisma.task.findMany({
    where: { deadline: { lt: now }, assigneeId: { not: null }, column: { board: { ownerId: null } } },
    select: { title: true, deadline: true, assigneeId: true },
  });

  await Promise.all([
    ...soon.map((task) => notifyTelegram("deadline_soon", `${task.title}: ${task.deadline?.toLocaleString("ru-RU")}`, task.assigneeId ? [task.assigneeId] : [])),
    ...overdue.map((task) => notifyTelegram("deadline_overdue", `${task.title}: ${task.deadline?.toLocaleString("ru-RU")}`, task.assigneeId ? [task.assigneeId] : [])),
  ]);

  return ok({ soon: soon.length, overdue: overdue.length });
}
