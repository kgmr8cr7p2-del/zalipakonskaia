import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { handleRouteError, ok } from "@/lib/http";
import { oilDepotSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const user = await requirePermission(PermissionKey.MANAGE_WORKSPACE);
    const input = oilDepotSchema.parse(await request.json());
    const oilDepot = await prisma.oilDepot.create({
      data: {
        name: input.name,
        active: input.active ?? true,
      },
    });

    await logActivity({
      action: "COLUMN_CHANGED",
      userId: user.id,
      details: { action: "oilDepotCreated", oilDepotId: oilDepot.id, name: oilDepot.name },
    });

    return ok({ oilDepot });
  } catch (error) {
    return handleRouteError(error);
  }
}
