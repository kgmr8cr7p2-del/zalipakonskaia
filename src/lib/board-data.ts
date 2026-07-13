import { ActivityAction, Prisma, RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/auth";
import { cleanupOldCompletedTasks } from "@/lib/cleanup";
import { accessibleBoardWhere } from "@/lib/board-access";

export const taskInclude = {
  column: true,
  oilDepot: true,
  author: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
  tags: { include: { tag: true } },
  checklists: { include: { items: true }, orderBy: { createdAt: "asc" as const } },
  comments: {
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  fileAttachments: {
    include: { uploader: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  activityLogs: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.TaskInclude;

export type TaskWithDetails = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

const reportTaskInclude = {
  column: true,
  oilDepot: true,
  assignee: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TaskInclude;

type ReportTask = Prisma.TaskGetPayload<{ include: typeof reportTaskInclude }>;

export async function getBoardView(user: CurrentUser, filters?: URLSearchParams) {
  await cleanupOldCompletedTasks();

  const requestedBoardId = filters?.get("board")?.trim();
  const board = await prisma.board.findFirst({
    where: requestedBoardId
      ? { id: requestedBoardId, ...accessibleBoardWhere(user.id) }
      : { ownerId: null },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          _count: { select: { tasks: true } },
          tasks: {
            where: { archivedAt: null },
            include: taskInclude,
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  if (!board) return null;

  const users = await prisma.user.findMany({
    where: board.ownerId ? { id: user.id } : undefined,
    include: { role: true, telegramConnection: true },
    orderBy: { name: "asc" },
  });
  const tags = await prisma.tag.findMany({
    where: { tasks: { some: { task: { column: { boardId: board.id } } } } },
    orderBy: { name: "asc" },
  });
  const oilDepots = await prisma.oilDepot.findMany({
    include: { _count: { select: { tasks: { where: { column: { boardId: board.id } } } } } },
    orderBy: { name: "asc" },
  });
  const activityLogs = await prisma.activityLog.findMany({
    where: { task: { column: { boardId: board.id } } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      task: { select: { id: true, taskNumber: true, title: true, oilDepot: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const availableBoards = await prisma.board.findMany({
    where: accessibleBoardWhere(user.id),
    select: { id: true, name: true, ownerId: true, _count: { select: { columns: true } } },
    orderBy: [{ ownerId: "asc" }, { createdAt: "asc" }],
  });

  const query = filters?.get("q")?.trim().toLowerCase();
  const priority = filters?.get("priority");
  const assignee = filters?.get("assignee");
  const tag = filters?.get("tag");
  const deadline = filters?.get("deadline");
  const status = filters?.get("status");
  const oilDepot = filters?.get("oilDepot");

  const filteredColumns = board.columns.map((column) => ({
    ...column,
    tasks: column.tasks.filter((task) => {
      if (status && task.columnId !== status) return false;
      if (priority && task.priority !== priority) return false;
      if (assignee && task.assigneeId !== assignee) return false;
      if (oilDepot && task.oilDepotId !== oilDepot) return false;
      if (tag && !task.tags.some((taskTag) => taskTag.tagId === tag)) return false;
      if (deadline === "overdue" && (!task.deadline || task.deadline >= new Date() || isCompletedColumn(task.column.name) || isReviewColumn(task.column.name))) return false;
      if (deadline === "week") {
        const week = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        if (!task.deadline || task.deadline > week) return false;
      }
      if (query) {
        const haystack = `${task.taskNumber} ${task.title} ${task.description} ${task.oilDepot?.name ?? ""} ${task.tags
          .map((item) => item.tag.name)
          .join(" ")}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    }),
  }));

  return {
    board: { ...board, columns: filteredColumns },
    availableBoards,
    users,
    tags,
    oilDepots,
    reports: buildReports(board.columns.flatMap((column) => column.tasks)),
    activityLogs,
    currentUser: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      emailVerifiedAt: user.emailVerifiedAt,
    },
    permissions: {
      canManageColumns: user.role.name === RoleName.ADMIN,
      canCreateTask: Boolean(board.ownerId) || user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER,
      canDeleteTask: Boolean(board.ownerId) || user.role.name === RoleName.ADMIN,
      canAssign: Boolean(board.ownerId) || user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER,
    },
  };
}

export async function getActivityHistory(filters?: URLSearchParams) {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setFullYear(defaultFrom.getFullYear() - 1);

  const from = parseDate(filters?.get("from")) ?? defaultFrom;
  const to = parseDate(filters?.get("to"), true) ?? now;
  const userId = filters?.get("userId") || "";
  const oilDepotId = filters?.get("oilDepot") || "";
  const action = filters?.get("action") || "";
  const validAction = Object.values(ActivityAction).includes(action as ActivityAction) ? (action as ActivityAction) : undefined;
  const oilDepotWhere: Prisma.ActivityLogWhereInput | undefined = oilDepotId
    ? oilDepotId === "__none"
      ? { task: { oilDepotId: null } }
      : {
          OR: [
            { task: { oilDepotId } },
            { details: { path: ["oilDepotId"], equals: oilDepotId } },
          ],
        }
    : undefined;

  return prisma.activityLog.findMany({
    where: {
      OR: [{ task: { column: { board: { ownerId: null } } } }, { taskId: null }],
      createdAt: {
        gte: from,
        lte: to,
      },
      userId: userId || undefined,
      action: validAction,
      ...oilDepotWhere,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      task: { select: { id: true, taskNumber: true, title: true, oilDepot: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
}

export async function getHistoryFilterOptions() {
  const [users, oilDepots] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.oilDepot.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, active: true },
    }),
  ]);

  return { users, oilDepots };
}

export async function getReportsData(filters?: URLSearchParams) {
  await cleanupOldCompletedTasks();

  const currentYear = new Date().getFullYear();
  const selectedYear = Number(filters?.get("year") || currentYear);
  const year = Number.isFinite(selectedYear) && selectedYear >= 2026 ? selectedYear : currentYear;
  const yearStart = new Date(`${year}-01-01T00:00:00.000`);
  const yearEnd = new Date(`${year}-12-31T23:59:59.999`);
  const from = parseDate(filters?.get("from")) ?? yearStart;
  const to = parseDate(filters?.get("to"), true) ?? yearEnd;
  const mode = normalizeReportMode(filters?.get("mode"));

  const tasks = await prisma.task.findMany({
    where: { column: { board: { ownerId: null } } },
    include: reportTaskInclude,
  });
  const activeTasks = tasks.filter((task) => !task.archivedAt);
  const period = buildPeriodReport(tasks, from, to);

  return {
    selected: {
      year,
      from: isoDate(from),
      to: isoDate(to),
      mode,
      years: Array.from({ length: Math.max(currentYear + 3, year) - 2026 + 1 }, (_, index) => 2026 + index),
    },
    week: buildReport(activeTasks, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    month: buildReport(activeTasks, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    year: buildPeriodReport(tasks, yearStart, yearEnd),
    period,
    monthly: buildMonthlyReport(tasks, year),
    chart: buildChartReport(tasks, mode, from, to, year),
    summary: {
      created: period.created,
      completed: period.completed,
      overdue: period.overdue,
      inProgress: activeTasks.filter((task) => isWorkColumn(task.column.name)).length,
      active: activeTasks.filter((task) => !isCompletedColumn(task.column.name)).length,
      total: activeTasks.length,
      completionRate: period.created ? Math.round((period.completed / period.created) * 1000) / 10 : 0,
    },
    dashboard: buildDashboardReport(tasks, from, to),
    byOilDepotStatus: buildCurrentOilDepotStatus(activeTasks),
  };
}

function buildDashboardReport(tasks: ReportTask[], from: Date, to: Date) {
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const isClosed = (task: ReportTask) => Boolean(task.archivedAt) || isCompletedColumn(task.column.name);
  const isClosedInPeriod = (task: ReportTask) => {
    const closedAt = task.archivedAt ?? (isCompletedColumn(task.column.name) ? task.updatedAt : null);
    return Boolean(closedAt && closedAt >= from && closedAt <= to);
  };
  const active = tasks.filter((task) => !isClosed(task));
  const completed = tasks.filter(isClosed);
  const completedInPeriod = tasks.filter(isClosedInPeriod);
  const overdue = active.filter((task) => task.deadline && task.deadline < now && !isReviewColumn(task.column.name));
  const dueSoon = active.filter((task) => task.deadline && task.deadline >= now && task.deadline <= soon);
  const inProgress = active.filter((task) => isWorkColumn(task.column.name));
  const progress = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;

  const reminders = active
    .filter((task) => task.deadline)
    .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      taskNumber: task.taskNumber,
      title: task.title,
      deadline: task.deadline,
      priority: task.priority,
      oilDepot: task.oilDepot?.name ?? "Без нефтебазы",
      assignee: task.assignee?.name ?? "Не назначен",
      overdue: task.deadline! < now && !isReviewColumn(task.column.name),
    }));

  const recentTasks = [...active]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 6)
    .map((task) => ({
      id: task.id,
      taskNumber: task.taskNumber,
      title: task.title,
      status: task.column.name,
      priority: task.priority,
      oilDepot: task.oilDepot?.name ?? "Без нефтебазы",
      assignee: task.assignee?.name ?? "Не назначен",
      updatedAt: task.updatedAt,
    }));

  const team = new Map<
    string,
    { id: string; name: string; email: string; active: number; completed: number; overdue: number }
  >();

  for (const task of tasks) {
    if (!task.assignee) continue;
    const member = team.get(task.assignee.id) ?? {
      ...task.assignee,
      active: 0,
      completed: 0,
      overdue: 0,
    };
    if (!isClosed(task)) member.active += 1;
    if (isClosedInPeriod(task)) member.completed += 1;
    if (!isClosed(task) && task.deadline && task.deadline < now && !isReviewColumn(task.column.name)) member.overdue += 1;
    team.set(task.assignee.id, member);
  }

  return {
    totals: {
      all: tasks.length,
      active: active.length,
      completed: completedInPeriod.length,
      inProgress: inProgress.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      unassigned: active.filter((task) => !task.assigneeId).length,
    },
    progress: {
      percent: progress,
      completed: completed.length,
      active: active.length,
      total: tasks.length,
    },
    reminders,
    recentTasks,
    team: Array.from(team.values())
      .sort((a, b) => b.active - a.active || b.completed - a.completed || a.name.localeCompare(b.name, "ru"))
      .slice(0, 6),
  };
}

function normalizeReportMode(value?: string | null) {
  return value === "week" || value === "month" || value === "quarter" || value === "period" || value === "year" ? value : "year";
}

function parseDate(value?: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildReports(tasks: TaskWithDetails[]) {
  const now = Date.now();
  return {
    week: buildReport(tasks, new Date(now - 7 * 24 * 60 * 60 * 1000)),
    month: buildReport(tasks, new Date(now - 30 * 24 * 60 * 60 * 1000)),
  };
}

function buildReport(tasks: Array<{ createdAt: Date; updatedAt: Date; deadline: Date | null; column: { name: string }; oilDepot: { name: string } | null }>, since: Date) {
  const inPeriod = tasks.filter((task) => new Date(task.createdAt) >= since);
  const completed = tasks.filter((task) => isCompletedColumn(task.column.name) && new Date(task.updatedAt) >= since);
  const overdue = tasks.filter((task) => task.deadline && new Date(task.deadline) < new Date() && !isCompletedColumn(task.column.name) && !isReviewColumn(task.column.name));
  const byOilDepot = new Map<string, number>();

  for (const task of inPeriod) {
    const depotName = task.oilDepot?.name ?? "Без нефтебазы";
    byOilDepot.set(depotName, (byOilDepot.get(depotName) ?? 0) + 1);
  }

  return {
    created: inPeriod.length,
    completed: completed.length,
    overdue: overdue.length,
    byOilDepot: Array.from(byOilDepot.entries()).map(([name, count]) => ({ name, count })),
  };
}

function buildPeriodReport(
  tasks: Array<{
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
    deadline: Date | null;
    column: { name: string };
    oilDepot: { name: string } | null;
  }>,
  from: Date,
  to: Date,
) {
  const inRange = (date?: Date | null) => !!date && date >= from && date <= to;
  const created = tasks.filter((task) => inRange(task.createdAt));
  const closed = tasks.filter((task) => inRange(task.archivedAt) || (isCompletedColumn(task.column.name) && inRange(task.updatedAt)));
  const overdue = tasks.filter((task) => !task.archivedAt && task.deadline && task.deadline < new Date() && !isCompletedColumn(task.column.name) && !isReviewColumn(task.column.name));

  return {
    created: created.length,
    completed: closed.length,
    overdue: overdue.length,
    byOilDepot: countByDepot(created),
    closedByOilDepot: countByDepot(closed),
  };
}

function buildMonthlyReport(
  tasks: Array<{
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
    deadline: Date | null;
    column: { name: string };
    oilDepot: { name: string } | null;
  }>,
  year: number,
) {
  const labels = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return labels.map((label, index) => {
    const start = new Date(year, index, 1, 0, 0, 0, 0);
    const end = new Date(year, index + 1, 0, 23, 59, 59, 999);
    const report = buildBucketReport(tasks, start, end);
    return {
      label,
      created: report.created,
      completed: report.completed,
      overdue: report.overdue,
    };
  });
}

function buildChartReport(
  tasks: Array<{
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
    deadline: Date | null;
    column: { name: string };
    oilDepot: { name: string } | null;
  }>,
  mode: string,
  from: Date,
  to: Date,
  year: number,
) {
  if (mode === "year") return buildMonthlyReport(tasks, year);

  const rangeDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  if (mode === "quarter" || (mode === "period" && rangeDays > 45)) {
    return buildMonthBuckets(tasks, from, to);
  }

  return buildDayBuckets(tasks, from, to);
}

function buildDayBuckets(
  tasks: Array<{
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
    deadline: Date | null;
    column: { name: string };
    oilDepot: { name: string } | null;
  }>,
  from: Date,
  to: Date,
) {
  const items = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    const start = new Date(cursor);
    const bucketEnd = new Date(cursor);
    bucketEnd.setHours(23, 59, 59, 999);
    const report = buildBucketReport(tasks, start, bucketEnd);
    items.push({ label: shortDate(start), ...report });
    cursor.setDate(cursor.getDate() + 1);
  }

  return items;
}

function buildMonthBuckets(
  tasks: Array<{
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
    deadline: Date | null;
    column: { name: string };
    oilDepot: { name: string } | null;
  }>,
  from: Date,
  to: Date,
) {
  const items = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);

  while (cursor <= end) {
    const start = new Date(cursor);
    const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    const boundedStart = start < from ? from : start;
    const boundedEnd = bucketEnd > to ? to : bucketEnd;
    const report = buildBucketReport(tasks, boundedStart, boundedEnd);
    items.push({ label: String(cursor.getMonth() + 1), ...report });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return items;
}

function buildBucketReport(
  tasks: Array<{
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
    deadline: Date | null;
    column: { name: string };
  }>,
  from: Date,
  to: Date,
) {
  const inRange = (date?: Date | null) => !!date && date >= from && date <= to;
  return {
    created: tasks.filter((task) => inRange(task.createdAt)).length,
    completed: tasks.filter((task) => inRange(task.archivedAt) || (isCompletedColumn(task.column.name) && inRange(task.updatedAt))).length,
    overdue: tasks.filter((task) => !task.archivedAt && task.deadline && inRange(task.deadline) && !isCompletedColumn(task.column.name) && !isReviewColumn(task.column.name)).length,
  };
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(date);
}

function buildCurrentOilDepotStatus(tasks: Array<{ column: { name: string; position: number }; oilDepot: { name: string } | null }>) {
  const depots = new Map<string, { name: string; total: number; statuses: Map<string, number> }>();
  const statusOrder = new Map<string, number>();

  for (const task of tasks) {
    const depotName = task.oilDepot?.name ?? "Без нефтебазы";
    const statusName = task.column.name;
    statusOrder.set(statusName, task.column.position);
    if (!depots.has(depotName)) depots.set(depotName, { name: depotName, total: 0, statuses: new Map() });
    const item = depots.get(depotName)!;
    item.total += 1;
    item.statuses.set(statusName, (item.statuses.get(statusName) ?? 0) + 1);
  }

  const columns = Array.from(statusOrder.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);

  return {
    columns,
    rows: Array.from(depots.values())
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .map((item) => ({
        name: item.name,
        total: item.total,
        statuses: columns.map((column) => ({ name: column, count: item.statuses.get(column) ?? 0 })),
      })),
  };
}

function countByDepot(tasks: Array<{ oilDepot: { name: string } | null }>) {
  const byOilDepot = new Map<string, number>();
  for (const task of tasks) {
    const depotName = task.oilDepot?.name ?? "Без нефтебазы";
    byOilDepot.set(depotName, (byOilDepot.get(depotName) ?? 0) + 1);
  }
  return Array.from(byOilDepot.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
    .map(([name, count]) => ({ name, count }));
}

function isCompletedColumn(name: string) {
  const normalized = name.toLowerCase();
  return normalized.includes("готов") || normalized.includes("РіРѕС‚РѕРІ".toLowerCase()) || normalized.includes("done") || normalized.includes("complete");
}

function isReviewColumn(name: string) {
  const normalized = name.toLowerCase();
  return normalized.includes("провер") || normalized.includes("review") || normalized.includes("verify") || normalized.includes("approval") || normalized.includes("РїСЂРѕРІРµСЂ".toLowerCase());
}

function isWorkColumn(name: string) {
  const normalized = name.toLowerCase();
  return normalized.includes("работ") || normalized.includes("progress") || normalized.includes("doing");
}
