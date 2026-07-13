import { AppShell } from "@/components/AppShell";
import { BoardClient } from "@/components/BoardClient";
import { requireVerifiedUser } from "@/lib/auth";
import { getBoardView } from "@/lib/board-data";
import { notFound } from "next/navigation";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireVerifiedUser();
  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") urlParams.set(key, value);
  }
  const view = await getBoardView(user, urlParams);
  if (!view) notFound();
  const serializable = JSON.parse(JSON.stringify(view));

  return (
    <AppShell user={user}>
      <BoardClient initialView={serializable} />
    </AppShell>
  );
}
