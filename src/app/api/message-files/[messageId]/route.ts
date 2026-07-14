import path from "node:path";
import { readFile } from "node:fs/promises";
import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { fail, handleRouteError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ messageId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const user = await requirePermission(PermissionKey.USE_CHATS);
    const { messageId } = await params;
    const message = await prisma.directMessage.findFirst({
      where: { id: messageId, OR: [{ senderId: user.id }, { recipientId: user.id }] },
      select: { id: true, fileName: true, mimeType: true },
    });
    if (!message?.fileName) return fail("Файл не найден", 404);
    const body = await readFile(path.join(process.cwd(), "uploads", "messages", message.id, "attachment"));
    const safeName = message.fileName.replace(/[\r\n\"]/g, "_");
    const showInline = new URL(request.url).searchParams.get("inline") === "1" && isPreviewableImageMime(message.mimeType);
    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": message.mimeType || "application/octet-stream",
        "content-disposition": `${showInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function isPreviewableImageMime(value?: string | null) {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp" || value === "image/gif";
}
