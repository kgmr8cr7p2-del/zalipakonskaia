import { AppShell } from "@/components/AppShell";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accessibleBoardWhere } from "@/lib/board-access";

export default async function ArchivePage() {
  const user = await requireVerifiedUser();
  const tasks = await prisma.task.findMany({
    where: { archivedAt: { not: null }, column: { board: accessibleBoardWhere(user.id) } },
    include: {
      column: true,
      oilDepot: true,
      assignee: { select: { id: true, name: true, email: true } },
      archivedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { archivedAt: "desc" },
    take: 300,
  });

  return (
    <AppShell user={user}>
      <div className="content insights-page">
        <section className="page-heading">
          <h1>Архив задач</h1>
          <p className="muted">Задачи не удаляются из базы, а сохраняются здесь после архивирования.</p>
        </section>
        <section className="history-panel history-page-panel">
          <div className="history-table archive-table">
            <div className="history-row history-row-head">
              <span>Номер</span>
              <span>Задача</span>
              <span>Статус</span>
              <span>Нефтебаза</span>
              <span>Архивировал</span>
              <span>Дата</span>
            </div>
            {tasks.length ? (
              tasks.map((task) => (
                <div className="history-row archive-row" key={task.id}>
                  <span>#{task.taskNumber}</span>
                  <span className="history-task">{task.title}</span>
                  <span>{task.column.name}</span>
                  <span>{task.oilDepot?.name ?? "Без нефтебазы"}</span>
                  <span>{task.archivedBy?.name ?? "Система"}</span>
                  <span className="history-meta">{task.archivedAt ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(task.archivedAt) : ""}</span>
                </div>
              ))
            ) : (
              <p className="muted history-empty">Архив пока пустой.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
