import { PermissionKey } from "@prisma/client";
import { Settings2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BoardSettings } from "@/components/BoardSettings";
import { GoidaTestButton } from "@/components/GoidaTestButton";
import { OilDepotSettings } from "@/components/OilDepotSettings";
import { PersonalBoardSettings } from "@/components/PersonalBoardSettings";
import { TelegramConnectPanel } from "@/components/TelegramConnectPanel";
import { requireVerifiedUser } from "@/lib/auth";
import { getBoardView } from "@/lib/board-data";
import { prisma } from "@/lib/prisma";
import { telegramBotLink } from "@/lib/telegram-link";
import { hasPermission } from "@/lib/role-permissions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const user = await requireVerifiedUser();
  const query = await searchParams;
  const filters = new URLSearchParams();
  if (query.board) filters.set("board", query.board);
  const canViewBoards = hasPermission(user, PermissionKey.VIEW_BOARD);
  const view = canViewBoards ? await getBoardView(user, filters) : null;
  const selectedBoard = view?.board;
  const telegramConnection = await prisma.telegramConnection.findUnique({ where: { userId: user.id }, select: { enabled: true } });
  const botLink = await telegramBotLink();

  return (
    <AppShell user={user}>
      <div className="content settings-page">
        <header className="settings-page-head">
          <span className="settings-page-kicker"><Settings2 size={17} /> Настройки рабочего пространства</span>
          <h1>Настройки Taskora</h1>
          <p>Управляйте досками, справочниками и подключением личных Telegram-уведомлений.</p>
        </header>
        {hasPermission(user, PermissionKey.USE_TELEGRAM) ? (
          <TelegramConnectPanel connected={Boolean(telegramConnection?.enabled)} botLink={botLink} />
        ) : null}
        <div className="settings-managers">
          {canViewBoards ? <PersonalBoardSettings initialBoards={JSON.parse(JSON.stringify((view?.availableBoards ?? []).filter((board: any) => board.ownerId === user.id)))} /> : null}
          {selectedBoard ? (
            <BoardSettings
              boardId={selectedBoard.id}
              boardName={selectedBoard.name}
              boards={JSON.parse(JSON.stringify(view?.availableBoards ?? []))}
              columns={JSON.parse(JSON.stringify(selectedBoard.columns))}
              canManage={selectedBoard.ownerId === user.id || hasPermission(user, PermissionKey.MANAGE_COLUMNS)}
            />
          ) : null}
          <OilDepotSettings oilDepots={JSON.parse(JSON.stringify(view?.oilDepots ?? []))} canManage={hasPermission(user, PermissionKey.MANAGE_WORKSPACE)} />
        </div>
        {user.email.toLowerCase() === "les_victor@mail.ru" ? (
          <section className="settings-utilities">
            <div className="settings-block goida-test-panel">
              <div>
                <h2>Проверка уведомления</h2>
                <p className="muted">Личный тест вечернего уведомления: звук проиграется один раз, окно закроется примерно через 15 секунд.</p>
              </div>
              <GoidaTestButton />
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
