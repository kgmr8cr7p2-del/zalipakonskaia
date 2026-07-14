import { BoardTvClient } from "@/components/BoardTvClient";
import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { getBoardView } from "@/lib/board-data";

export default async function BoardTvPage() {
  const user = await requirePermission(PermissionKey.VIEW_BOARD);
  const view = await getBoardView(user);
  const serializable = JSON.parse(JSON.stringify(view));

  return <BoardTvClient initialView={serializable} />;
}
