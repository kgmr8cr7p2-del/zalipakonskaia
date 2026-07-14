import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { getBoardView } from "@/lib/board-data";
import { fail, ok } from "@/lib/http";

export async function GET(request: Request) {
  const user = await requirePermission(PermissionKey.VIEW_BOARD);
  const view = await getBoardView(user, new URL(request.url).searchParams);
  if (!view) return fail("Доска не найдена", 404);
  return ok(view);
}
