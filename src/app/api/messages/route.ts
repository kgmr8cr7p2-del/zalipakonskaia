import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { requireVerifiedUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const messageSelect = {
  id: true,
  text: true,
  senderId: true,
  recipientId: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  readAt: true,
  createdAt: true,
} as const;

export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const targetId = new URL(request.url).searchParams.get("userId")?.trim();
    if (!targetId || targetId === user.id) return fail("Собеседник не выбран", 422);
    const target = await prisma.user.findFirst({ where: { id: targetId, approvedAt: { not: null } }, select: { id: true } });
    if (!target) return fail("Пользователь не найден", 404);

    await prisma.directMessage.updateMany({
      where: { senderId: targetId, recipientId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: user.id, recipientId: targetId },
          { senderId: targetId, recipientId: user.id },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: messageSelect,
    });
    return ok({ messages: messages.reverse() });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const formData = await request.formData();
    const targetId = String(formData.get("userId") ?? "").trim();
    const text = String(formData.get("text") ?? "").trim();
    const candidate = formData.get("file");
    const file = candidate instanceof File && candidate.size ? candidate : null;
    if (!targetId || targetId === user.id) return fail("Собеседник не выбран", 422);
    if (!text && !file) return fail("Напишите сообщение или прикрепите файл", 422);
    if (text.length > 4000) return fail("Сообщение не должно превышать 4000 символов", 422);
    if (file && file.size > MAX_FILE_BYTES) return fail("Файл не должен превышать 15 МБ", 422);
    const target = await prisma.user.findFirst({ where: { id: targetId, approvedAt: { not: null } }, select: { id: true } });
    if (!target) return fail("Пользователь не найден", 404);

    const message = await prisma.directMessage.create({
      data: {
        senderId: user.id,
        recipientId: targetId,
        text,
        fileName: file?.name ?? null,
        fileSize: file?.size ?? null,
        mimeType: file?.type || null,
      },
      select: messageSelect,
    });

    if (file) {
      try {
        const directory = path.join(process.cwd(), "uploads", "messages", message.id);
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, "attachment"), Buffer.from(await file.arrayBuffer()));
      } catch (error) {
        await prisma.directMessage.delete({ where: { id: message.id } }).catch(() => undefined);
        throw error;
      }
    }
    return ok({ message });
  } catch (error) {
    return handleRouteError(error);
  }
}
