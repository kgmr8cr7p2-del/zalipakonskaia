import { AppShell } from "@/components/AppShell";
import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accessibleBoardWhere } from "@/lib/board-access";
import { ArchiveBrowser } from "@/components/ArchiveBrowser";

export default async function ArchivePage() {
  const user = await requirePermission(PermissionKey.VIEW_BOARD);
  const tasks = await prisma.task.findMany({
    where: { archivedAt: { not: null }, column: { board: accessibleBoardWhere(user) } },
    include: {
      column: true,
      oilDepot: true,
      assignee: { select: { id: true, name: true, email: true } },
      assignees: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { assignedAt: "asc" } },
      author: { select: { id: true, name: true, email: true } },
      archivedBy: { select: { id: true, name: true, email: true } },
      checklists: { include: { items: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } },
      comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      fileAttachments: { include: { uploader: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
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
        <ArchiveBrowser tasks={JSON.parse(JSON.stringify(tasks))} />
      </div>
    </AppShell>
  );
}
