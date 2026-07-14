import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { roleSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    await requirePermission(PermissionKey.MANAGE_USERS);
    const input = roleSchema.parse(await request.json());
    const duplicate = await prisma.role.findUnique({ where: { name: input.name } });
    if (duplicate) return fail("Роль с таким названием уже существует", 409);
    const role = await prisma.role.create({ data: input });
    return ok({ role }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
