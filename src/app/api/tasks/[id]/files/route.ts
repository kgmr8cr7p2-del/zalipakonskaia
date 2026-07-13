import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { ActivityAction } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditTask } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { fail, handleRouteError, ok } from "@/lib/http";
import { canAccessTask } from "@/lib/board-access";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const access = await canAccessTask(user.id, id);
    if (!access) return fail("Задача не найдена", 404);
    const task = await prisma.task.findUnique({ where: { id }, include: { assignees: { select: { userId: true } } } });
    if (!task) return fail("Задача не найдена", 404);
    if (access.column.board.ownerId !== user.id && !canEditTask(user, task)) return fail("Недостаточно прав", 403);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return fail("Файл не передан", 422);
    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_");
    const folder = path.join(process.cwd(), "uploads", id);
    await mkdir(folder, { recursive: true });
    const fileName = `${Date.now()}-${safeName}`;
    await writeFile(path.join(folder, fileName), bytes);

    const attachment = await prisma.fileAttachment.create({
      data: {
        fileName: file.name,
        url: `/api/files/${id}/${encodeURIComponent(fileName)}`,
        size: bytes.byteLength,
        mimeType: file.type || "application/octet-stream",
        taskId: id,
        uploaderId: user.id,
      },
      include: { uploader: { select: { id: true, name: true, email: true } } },
    });
    await logActivity({
      action: ActivityAction.FILE_UPLOADED,
      userId: user.id,
      taskId: id,
      details: { fileName: attachment.fileName },
    });
    return ok({ attachment });
  } catch (error) {
    return handleRouteError(error);
  }
}
