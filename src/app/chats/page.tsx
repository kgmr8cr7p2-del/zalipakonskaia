import { MessageCircleMore } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ChatHub } from "@/components/ChatHub";
import { requireVerifiedUser } from "@/lib/auth";

export default async function ChatsPage() {
  const user = await requireVerifiedUser();

  return (
    <AppShell user={user}>
      <div className="content chats-page">
        <header className="chats-page-head">
          <span className="settings-page-kicker"><MessageCircleMore size={17} /> Командное общение</span>
          <h1>Чаты</h1>
          <p>Найдите коллегу по имени и продолжите переписку. Непрочитанные сообщения отмечены счётчиком.</p>
        </header>
        <ChatHub viewerId={user.id} />
      </div>
    </AppShell>
  );
}
