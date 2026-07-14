import path from "node:path";
import { readFile } from "node:fs/promises";
import { requireVerifiedUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { canAccessTask } from "@/lib/board-access";

type Params = { params: Promise<{ taskId: string; fileName: string }> };

export async function GET(_: Request, { params }: Params) {
  const user = await requireVerifiedUser();
  const { taskId, fileName } = await params;
  if (!(await canAccessTask(user, taskId))) return fail("Файл не найден", 404);
  const safeName = decodeURIComponent(fileName).replace(/[\\/]/g, "");
  const filePath = path.join(process.cwd(), "uploads", taskId, safeName);
  try {
    const file = await readFile(filePath);
    return new Response(file);
  } catch {
    return fail("Файл не найден", 404);
  }
}
