import path from "node:path";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleRouteError, ok } from "@/lib/http";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  try {
    const user = await requireAccountUser();
    const formData = await request.formData();
    const file = formData.get("avatar");
    if (!(file instanceof File)) return fail("Выберите изображение", 422);
    const extension = extensions[file.type];
    if (!extension) return fail("Поддерживаются JPG, PNG, WebP и GIF", 422);
    if (file.size > MAX_AVATAR_BYTES) return fail("Размер аватара не должен превышать 5 МБ", 422);

    const directory = path.join(process.cwd(), "uploads", "profiles", user.id);
    await mkdir(directory, { recursive: true });
    const fileName = `avatar-${Date.now()}.${extension}`;
    await writeFile(path.join(directory, fileName), Buffer.from(await file.arrayBuffer()));

    const avatarUrl = `/api/profile-avatars/${user.id}/${fileName}`;
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });

    const oldFiles = (await readdir(directory)).filter((name) => name !== fileName);
    await Promise.all(oldFiles.map((name) => rm(path.join(directory, name), { force: true }).catch(() => undefined)));
    return ok({ avatarUrl });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireAccountUser();
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
    await rm(path.join(process.cwd(), "uploads", "profiles", user.id), { recursive: true, force: true }).catch(() => undefined);
    return ok({ avatarUrl: null });
  } catch (error) {
    return handleRouteError(error);
  }
}
