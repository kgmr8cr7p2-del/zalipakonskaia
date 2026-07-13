import { AppShell } from "@/components/AppShell";
import { BoardSettings } from "@/components/BoardSettings";
import { GoidaTestButton } from "@/components/GoidaTestButton";
import { OilDepotSettings } from "@/components/OilDepotSettings";
import { PersonalBoardSettings } from "@/components/PersonalBoardSettings";
import { requireVerifiedUser } from "@/lib/auth";
import { getBoardView } from "@/lib/board-data";

export default async function SettingsPage() {
  const user = await requireVerifiedUser();
  const view = await getBoardView(user);

  return (
    <AppShell user={user}>
      <div className="content settings-page">
        <header className="settings-page-head">
          <span className="settings-page-kicker"><Settings2 size={17} /> Управление структурой</span>
          <h1>Настройки доски</h1>
          <p>Колонки определяют рабочий процесс, а нефтебазы помогают связывать задачи с объектами.</p>
        </header>
        <div className="settings-managers">
          <PersonalBoardSettings initialBoards={JSON.parse(JSON.stringify((view?.availableBoards ?? []).filter((board: any) => board.ownerId === user.id)))} />
          <BoardSettings columns={JSON.parse(JSON.stringify(view?.board.columns ?? []))} canManage={user.role.name === "ADMIN"} />
          <OilDepotSettings oilDepots={JSON.parse(JSON.stringify(view?.oilDepots ?? []))} canManage={user.role.name === "ADMIN"} />
        </div>
        <section className="settings-utilities">
          {user.email.toLowerCase() === "les_victor@mail.ru" ? (
            <div className="settings-block goida-test-panel">
              <div>
                <h2>Проверка уведомления</h2>
                <p className="muted">Личный тест вечернего уведомления: звук проиграется один раз, окно закроется примерно через 15 секунд.</p>
              </div>
              <GoidaTestButton />
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
import { Settings2 } from "lucide-react";
