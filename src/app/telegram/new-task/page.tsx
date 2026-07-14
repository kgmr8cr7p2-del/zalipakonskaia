import Script from "next/script";
import { redirect } from "next/navigation";
import { TelegramTaskCreator } from "@/components/TelegramTaskCreator";
import { requireVerifiedUser } from "@/lib/auth";
import { getBoardView } from "@/lib/board-data";

export default async function TelegramNewTaskPage() {
  const user = await requireVerifiedUser();

  const view = await getBoardView(user);
  if (!view) redirect("/board");

  const canCreate = user.role.name === "ADMIN" || user.role.name === "MANAGER";
  const formData = {
    currentUser: { name: user.name },
    columns: view.board.columns.map((column) => ({ id: column.id, name: column.name })),
    oilDepots: view.oilDepots.filter((depot) => depot.active).map((depot) => ({ id: depot.id, name: depot.name })),
    users: view.users.map((item) => ({ id: item.id, name: item.name })),
  };

  return (
    <main className="telegram-create-page">
      <Script src="https://telegram.org/js/telegram-web-app.js?59" strategy="afterInteractive" />
      <TelegramTaskCreator canCreate={canCreate} data={formData} />
    </main>
  );
}
