import { PermissionKey } from "@prisma/client";
import { Settings2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BoardSettings } from "@/components/BoardSettings";
import { GoidaTestButton } from "@/components/GoidaTestButton";
import { NotificationSoundSettings } from "@/components/NotificationSoundSettings";
import { OilDepotSettings } from "@/components/OilDepotSettings";
import { PersonalBoardSettings } from "@/components/PersonalBoardSettings";
import { SettingsHub, type SettingsPanel } from "@/components/SettingsHub";
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
        <SettingsHub panels={[
          ...(hasPermission(user, PermissionKey.USE_TELEGRAM) ? [{ id: "telegram", title: "Telegram-уведомления", description: "Подключение личного чата с ботом", icon: "message" as const, content: <TelegramConnectPanel connected={Boolean(telegramConnection?.enabled)} botLink={botLink} /> }] : []),
          { id: "sounds", title: "Звуки уведомлений", description: "Громкость, включение и проверка звука", icon: "volume" as const, content: <NotificationSoundSettings /> },
          ...(canViewBoards ? [{ id: "personal-boards", title: "Личные доски", description: "Создание и порядок ваших личных досок", icon: "bell" as const, content: <PersonalBoardSettings initialBoards={JSON.parse(JSON.stringify((view?.availableBoards ?? []).filter((board: any) => board.ownerId === user.id)))} /> }] : []),
          ...(selectedBoard ? [{ id: "board", title: "Рабочая доска", description: "Колонки и параметры выбранной доски", icon: "database" as const, content: <BoardSettings boardId={selectedBoard.id} boardName={selectedBoard.name} boards={JSON.parse(JSON.stringify(view?.availableBoards ?? []))} columns={JSON.parse(JSON.stringify(selectedBoard.columns))} canManage={selectedBoard.ownerId === user.id || hasPermission(user, PermissionKey.MANAGE_COLUMNS)} /> }] : []),
          { id: "depots", title: "Нефтебазы", description: "Справочник объектов рабочего пространства", icon: "building" as const, content: <OilDepotSettings oilDepots={JSON.parse(JSON.stringify(view?.oilDepots ?? []))} canManage={hasPermission(user, PermissionKey.MANAGE_WORKSPACE)} /> },
          ...(user.email.toLowerCase() === "les_victor@mail.ru" ? [{ id: "test", title: "Проверка уведомлений", description: "Тестовое вечернее уведомление", icon: "bell" as const, content: <div className="settings-block goida-test-panel"><div><h2>Проверка уведомления</h2><p className="muted">Личный тест вечернего уведомления.</p></div><GoidaTestButton /></div> }] : []),
        ] satisfies SettingsPanel[]} />
      </div>
    </AppShell>
  );
}
