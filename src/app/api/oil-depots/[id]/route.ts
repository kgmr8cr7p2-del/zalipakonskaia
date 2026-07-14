import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { fail, handleRouteError, ok } from "@/lib/http";
import { oilDepotSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requirePermission(PermissionKey.MANAGE_WORKSPACE);
    const { id } = await params;
    const body = await request.json();
    const input = oilDepotSchema.partial().parse(body);
    const oilDepot = await prisma.oilDepot.update({
      where: { id },
      data: {
        name: input.name,
        active: input.active,
      },
    });

    await logActivity({
      action: "COLUMN_CHANGED",
      userId: user.id,
      details: { action: "oilDepotUpdated", oilDepotId: oilDepot.id, name: oilDepot.name },
    });

    return ok({ oilDepot });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const user = await requirePermission(PermissionKey.MANAGE_WORKSPACE);
    const { id } = await params;
    const taskCount = await prisma.task.count({ where: { oilDepotId: id } });
    if (taskCount > 0) return fail("Нельзя удалить нефтебазу, пока к ней привязаны задачи", 409);

    await prisma.oilDepot.delete({ where: { id } });
    await logActivity({
      action: "COLUMN_CHANGED",
      userId: user.id,
      details: { action: "oilDepotDeleted", oilDepotId: id },
    });

    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
