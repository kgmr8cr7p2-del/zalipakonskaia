import path from "node:path";
import { readFile } from "node:fs/promises";
import { requireAccountUser } from "@/lib/auth";
import { fail } from "@/lib/http";

type Params = { params: Promise<{ userId: string; fileName: string }> };

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(_: Request, { params }: Params) {
  const viewer = await requireAccountUser();
  const { userId, fileName } = await params;
  if (!viewer.approvedAt && viewer.id !== userId) return fail("Аватар не найден", 404);
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeUserId || !safeFileName || safeUserId !== userId || safeFileName !== fileName) return fail("Аватар не найден", 404);
  const contentType = contentTypes[path.extname(safeFileName).toLowerCase()];
  if (!contentType) return fail("Аватар не найден", 404);

  try {
    const file = await readFile(path.join(process.cwd(), "uploads", "profiles", safeUserId, safeFileName));
    return new Response(file, {
      headers: {
        "content-type": contentType,
        "cache-control": "private, max-age=86400",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return fail("Аватар не найден", 404);
  }
}
