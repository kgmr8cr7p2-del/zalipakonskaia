import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { issueTelegramConnectCode } from "@/lib/telegram-connect-code";

export async function POST() {
  const user = await requirePermission(PermissionKey.USE_TELEGRAM);
  const result = await issueTelegramConnectCode(user.id);
  return Response.json(result);
}
