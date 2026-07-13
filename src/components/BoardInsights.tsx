import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Layers3,
  ListTodo,
  PieChart,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import type { CSSProperties } from "react";
import BorderGlow from "@/components/BorderGlow/BorderGlow";
import { ReportLineChart } from "@/components/ReportLineChart";

export function ReportsPanel({ reports }: { reports: any }) {
  const statusCount = Math.max(1, reports?.byOilDepotStatus?.columns?.length ?? 1);
  const rows = reports?.byOilDepotStatus?.rows ?? [];
  const statusColumns = reports?.byOilDepotStatus?.columns ?? [];
  const statusTotals = statusColumns.map((column: string, index: number) => ({
    name: column,
    count: rows.reduce((sum: number, row: any) => sum + (row.statuses[index]?.count ?? 0), 0),
  }));
  const depotTotal = Math.max(1, rows.reduce((sum: number, row: any) => sum + row.total, 0));
  const topDepots = [...rows].sort((a: any, b: any) => b.total - a.total || a.name.localeCompare(b.name, "ru")).slice(0, 6);
  const closedByDepot = reports?.period?.closedByOilDepot ?? [];
  const chartData = reports?.chart ?? reports?.monthly ?? [];
  const dashboard = reports?.dashboard ?? {};
  const totals = dashboard.totals ?? {};
  const progress = dashboard.progress ?? { percent: 0, completed: 0, active: 0, total: 0 };
  const reminders = dashboard.reminders ?? [];
  const recentTasks = dashboard.recentTasks ?? [];
  const team = dashboard.team ?? [];
  const maxTeamLoad = Math.max(1, ...team.map((member: any) => member.active));
  const summaryCards = [
    {
      title: "Всего задач",
      value: totals.all ?? 0,
      note: `${totals.active ?? 0} сейчас активны`,
      icon: Layers3,
      tone: "primary",
      metric: "created",
      glow: { color: "215 100 72", colors: ["#93c5fd", "#c084fc", "#60a5fa"] },
    },
    {
      title: "Закрыто за период",
      value: totals.completed ?? 0,
      note: `${progress.percent ?? 0}% общего прогресса`,
      icon: CheckCircle2,
      tone: "green",
      metric: "completed",
      glow: { color: "150 72 58", colors: ["#86efac", "#34d399", "#67e8f9"] },
    },
    {
      title: "В работе",
      value: totals.inProgress ?? 0,
      note: `${totals.dueSoon ?? 0} со сроком на неделе`,
      icon: Clock3,
      tone: "blue",
      metric: "created",
      glow: { color: "205 100 68", colors: ["#7dd3fc", "#60a5fa", "#818cf8"] },
    },
    {
      title: "Просрочено",
      value: totals.overdue ?? 0,
      note: (totals.overdue ?? 0) ? "Требуют внимания" : "Все сроки под контролем",
      icon: AlertTriangle,
      tone: "red",
      metric: "overdue",
      glow: { color: "348 83 62", colors: ["#fda4af", "#fb7185", "#f0abfc"] },
    },
  ];

  return (
    <section className="reports-panel reports-page-grid reports-dashboard" aria-label="Дашборд отчетов">
      <div className="report-kpi-grid">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <BorderGlow
              className="report-kpi-glow"
              key={card.title}
              edgeSensitivity={24}
              glowColor={card.glow.color}
              backgroundColor={card.tone === "primary" ? "var(--brand-strong)" : "var(--panel)"}
              borderRadius={8}
              glowRadius={20}
              glowIntensity={0.72}
              coneSpread={24}
              animated
              fillOpacity={0.18}
              colors={card.glow.colors}
            >
              <article className={`report-kpi report-kpi-${card.tone}`}>
                <span className="report-kpi-top">
                  <span className="report-kpi-label">
                    <Icon size={16} />
                    {card.title}
                  </span>
                  <span className="report-kpi-link" aria-hidden="true">
                    <ArrowUpRight size={15} />
                  </span>
                </span>
                <strong>{card.value}</strong>
                <small>
                  <TrendingUp size={13} />
                  {card.note}
                </small>
                <MiniSparkline data={chartData} metric={card.metric} />
              </article>
            </BorderGlow>
          );
        })}
      </div>

      <div className="report-dashboard-grid">
        <article className="report-card report-activity-card">
          <div className="report-card-head">
            <div className="report-title">
              <TrendingUp size={16} />
              <div>
                <h2>Динамика задач</h2>
                <p>Создание и завершение за выбранный период</p>
              </div>
            </div>
            <div className="report-legend">
              <span className="legend-created">Создано</span>
              <span className="legend-completed">Закрыто</span>
              <span className="legend-overdue">Просрочено</span>
            </div>
          </div>
          <ReportLineChart data={chartData} />
        </article>

        <article className="report-card report-reminders-card">
          <div className="report-title">
            <CalendarClock size={16} />
            <div>
              <h2>Ближайшие сроки</h2>
              <p>Задачи с ближайшим дедлайном</p>
            </div>
          </div>
          <div className="report-reminder-list">
            {reminders.length ? (
              reminders.map((task: any) => (
                <a className="report-reminder" href={`/board?q=${encodeURIComponent(String(task.taskNumber))}`} key={task.id}>
                  <span className={`report-priority-mark report-priority-${String(task.priority).toLowerCase()}`} />
                  <span className="report-reminder-body">
                    <strong>#{task.taskNumber} {task.title}</strong>
                    <small>{task.oilDepot} · {task.assignee}</small>
                  </span>
                  <time className={task.overdue ? "is-overdue" : ""} dateTime={String(task.deadline)}>
                    {deadlineLabel(task.deadline, task.overdue)}
                  </time>
                </a>
              ))
            ) : (
              <ReportEmpty icon={<CalendarClock size={18} />} text="Нет задач с установленным сроком" />
            )}
          </div>
        </article>

        <article className="report-card report-team-card">
          <div className="report-title">
            <UsersRound size={16} />
            <div>
              <h2>Загрузка команды</h2>
              <p>Активные и завершённые задачи</p>
            </div>
          </div>
          <div className="report-team-list">
            {team.length ? (
              team.map((member: any, index: number) => (
                <div className="report-team-row" key={member.id}>
                  <span
                    className="report-team-avatar"
                    style={{ "--avatar-color": avatarColors[index % avatarColors.length] } as CSSProperties}
                  >
                    {initials(member.name)}
                  </span>
                  <span className="report-team-person">
                    <strong>{member.name}</strong>
                    <small>{member.active} активных · {member.completed} закрыто</small>
                    <span className="report-team-meter">
                      <i style={{ "--team-load": `${Math.round((member.active / maxTeamLoad) * 100)}%` } as CSSProperties} />
                    </span>
                  </span>
                  <span className={member.overdue ? "report-team-state is-alert" : "report-team-state"}>
                    {member.overdue ? `${member.overdue} проср.` : "В норме"}
                  </span>
                </div>
              ))
            ) : (
              <ReportEmpty icon={<UsersRound size={18} />} text="Назначенных исполнителей пока нет" />
            )}
          </div>
        </article>

        <article className="report-card report-progress-card">
          <div className="report-title">
            <PieChart size={16} />
            <div>
              <h2>Общий прогресс</h2>
              <p>Доля завершённых задач</p>
            </div>
          </div>
          <ProgressGauge percent={progress.percent ?? 0} />
          <div className="report-progress-meta">
            <span><i className="progress-dot-completed" />Закрыто <strong>{progress.completed ?? 0}</strong></span>
            <span><i className="progress-dot-active" />Активно <strong>{progress.active ?? 0}</strong></span>
            <span><i className="progress-dot-unassigned" />Без исполнителя <strong>{totals.unassigned ?? 0}</strong></span>
          </div>
        </article>

        <article className="report-card report-task-feed-card">
          <div className="report-title">
            <ListTodo size={16} />
            <div>
              <h2>Актуальные задачи</h2>
              <p>Последние обновления на доске</p>
            </div>
          </div>
          <div className="report-task-feed">
            {recentTasks.length ? (
              recentTasks.map((task: any) => (
                <a className="report-task-row" href={`/board?q=${encodeURIComponent(String(task.taskNumber))}`} key={task.id}>
                  <span className={`report-task-icon report-priority-${String(task.priority).toLowerCase()}`}>
                    <CheckSquare size={15} />
                  </span>
                  <span>
                    <strong>#{task.taskNumber} {task.title}</strong>
                    <small>{task.oilDepot} · {task.assignee}</small>
                  </span>
                  <b>{task.status}</b>
                </a>
              ))
            ) : (
              <ReportEmpty icon={<ListTodo size={18} />} text="Активных задач сейчас нет" />
            )}
          </div>
        </article>

        <article className="report-card report-depots-card">
          <div className="report-title">
            <Building2 size={16} />
            <div>
              <h2>Задачи по нефтебазам</h2>
              <p>Доля в общей загрузке</p>
            </div>
          </div>
          <div className="report-donut-wrap">
            <DepotDonut rows={topDepots} total={depotTotal} />
            <div className="report-donut-list">
              {topDepots.length ? (
                topDepots.map((row: any, index: number) => (
                  <div className="report-donut-row" key={row.name}>
                    <span className="donut-dot" style={{ "--dot-color": chartColors[index % chartColors.length] } as CSSProperties} />
                    <span>{row.name}</span>
                    <strong>{row.total}</strong>
                    <small>{Math.round((row.total / depotTotal) * 1000) / 10}%</small>
                  </div>
                ))
              ) : (
                <ReportEmpty icon={<Building2 size={18} />} text="Активных задач сейчас нет" />
              )}
            </div>
          </div>
        </article>

        <article className="report-card report-status-card">
          <div className="report-title">
            <CheckSquare size={16} />
            <div>
              <h2>Статусы по нефтебазам</h2>
              <p>Текущая загрузка по этапам доски</p>
            </div>
          </div>
          <div className="report-status-table">
            <div className="report-status-row report-status-head" style={{ "--status-count": statusCount } as CSSProperties}>
              <span>Нефтебаза</span>
              {statusColumns.map((column: string) => (
                <span key={column}>{column}</span>
              ))}
              <span>Всего</span>
            </div>
            {rows.length ? (
              <>
                {rows.map((row: any) => (
                  <div className="report-status-row" key={row.name} style={{ "--status-count": statusCount } as CSSProperties}>
                    <strong>{row.name}</strong>
                    {row.statuses.map((status: any) => (
                      <span key={status.name}>{status.count}</span>
                    ))}
                    <b>{row.total}</b>
                  </div>
                ))}
                <div className="report-status-row report-status-total" style={{ "--status-count": statusCount } as CSSProperties}>
                  <strong>Итого</strong>
                  {statusTotals.map((status: any) => (
                    <b key={status.name}>{status.count}</b>
                  ))}
                  <b>{rows.reduce((sum: number, row: any) => sum + row.total, 0)}</b>
                </div>
              </>
            ) : (
              <ReportEmpty icon={<CheckSquare size={18} />} text="Активных задач сейчас нет" />
            )}
          </div>
        </article>
      </div>

      <article className="report-card report-card-wide report-closed-summary">
        <div className="report-title">
          <CheckCircle2 size={16} />
          <h2>Закрыто по нефтебазам за выбранный период</h2>
        </div>
        <div className="report-closed-grid">
          {closedByDepot.length ? (
            closedByDepot.map((item: any) => (
              <span key={item.name}>
                <strong>{item.count}</strong>
                {item.name}
              </span>
            ))
          ) : (
            <span>
              <strong>0</strong>
              Закрытых задач за выбранный период нет
            </span>
          )}
        </div>
      </article>
    </section>
  );
}

const chartColors = ["#2563eb", "#16a34a", "#d97706", "#0f766e", "#64748b", "#dc2626"];
const avatarColors = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#0369a1"];

function ReportEmpty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="report-empty-state">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function ProgressGauge({ percent }: { percent: number }) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="report-progress-gauge" aria-label={`Завершено ${safePercent}% задач`}>
      <svg viewBox="0 0 200 112" aria-hidden="true">
        <path className="report-progress-track" d="M 20 98 A 80 80 0 0 1 180 98" pathLength="100" />
        <path
          className="report-progress-value"
          d="M 20 98 A 80 80 0 0 1 180 98"
          pathLength="100"
          strokeDasharray={`${safePercent} ${100 - safePercent}`}
        />
      </svg>
      <span>
        <strong>{safePercent}%</strong>
        <small>завершено</small>
      </span>
    </div>
  );
}

function deadlineLabel(value: string, overdue: boolean) {
  const deadline = new Date(value);
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const difference = Math.ceil((deadline.getTime() - now.getTime()) / day);
  if (overdue) return `Просрочено ${Math.max(1, Math.abs(difference))} дн.`;
  if (difference <= 0) return "Сегодня";
  if (difference === 1) return "Завтра";
  if (difference <= 7) return `Через ${difference} дн.`;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(deadline);
}

function initials(name: string) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function MiniSparkline({ data, metric }: { data: any[]; metric: string }) {
  const points = buildChartPoints(data, metric, 100, 36);
  return (
    <svg className="mini-sparkline" viewBox="0 0 100 36" role="presentation" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DepotDonut({ rows, total }: { rows: any[]; total: number }) {
  let cursor = 0;
  const gradient = rows.length
    ? `conic-gradient(${rows
        .map((row, index) => {
          const start = cursor;
          cursor += (row.total / total) * 100;
          return `${chartColors[index % chartColors.length]} ${start}% ${cursor}%`;
        })
        .join(", ")})`
    : "conic-gradient(#e5e7eb 0 100%)";

  return (
    <div className="report-donut" style={{ "--donut": gradient } as CSSProperties}>
      <span>{rows.length ? `${Math.round((rows[0].total / total) * 1000) / 10}%` : "0%"}</span>
    </div>
  );
}

function buildChartPoints(data: any[], metric: string, width: number, height: number) {
  return pointsToString(buildChartCoordinates(data, metric, width, height));
}

function buildChartCoordinates(data: any[], metric: string, width: number, height: number) {
  if (!data.length) return [
    { x: 0, y: height },
    { x: width, y: height },
  ];
  const max = Math.max(1, ...data.flatMap((item) => [item.created ?? 0, item.completed ?? 0, item.overdue ?? 0]));
  return data
    .map((item, index) => {
      const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
      const value = item[metric] ?? 0;
      const y = height - (value / max) * (height - 8) + 2;
      return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
    });
}

function pointsToString(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function GlobalHistory({ logs }: { logs: any[] }) {
  return (
    <section className="history-panel history-page-panel" aria-label="Общая история действий">
      <div className="timeline-head">
        <span className="timeline-icon">
          <CheckSquare size={16} />
        </span>
        <div>
          <h2>Журнал изменений</h2>
          <p className="muted">Действия по задачам, файлам, комментариям и настройкам доски</p>
        </div>
      </div>
      <div className="history-table" role="table" aria-label="История действий">
        <div className="history-row history-row-head" role="row">
          <span>Дата</span>
          <span>Действие</span>
          <span>Задача</span>
          <span>Нефтебаза</span>
          <span>Пользователь</span>
          <span>Подробности</span>
        </div>
        {logs?.length ? (
          logs.map((log) => (
            <div className="history-row" role="row" key={log.id}>
              <span className="history-meta" data-label="Дата">{dateTime(log.createdAt)}</span>
              <span className="history-action" data-label="Действие">{activityLabel(log)}</span>
              <span className="history-task" data-label="Задача">{historyTaskLabel(log)}</span>
              <span data-label="Нефтебаза">{historyOilDepotLabel(log)}</span>
              <span className="history-meta" data-label="Пользователь">{log.user?.name ?? "Система"}</span>
              <span className="history-details" data-label="Подробности">{activityDetails(log)}</span>
            </div>
          ))
        ) : (
          <p className="muted history-empty">За выбранный период событий нет.</p>
        )}
      </div>
    </section>
  );
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function activityLabel(log: any) {
  if (log.action === "TASK_DELETED" && log.details?.archived) return "Задача отправлена в архив";
  if (log.action === "TASK_DELETED" && log.details?.deletedPermanently) return "Задача удалена";

  const labels: Record<string, string> = {
    TASK_CREATED: "Создание задачи",
    TITLE_CHANGED: "Название изменено",
    DESCRIPTION_CHANGED: "Описание изменено",
    STATUS_CHANGED: "Статус изменен",
    PRIORITY_CHANGED: "Приоритет изменен",
    START_DATE_CHANGED: "Дата начала изменена",
    DEADLINE_CHANGED: "Срок изменен",
    ASSIGNEE_CHANGED: "Исполнитель изменен",
    COMMENT_ADDED: "Комментарий добавлен",
    FILE_UPLOADED: "Файл загружен",
    CHECKLIST_CHANGED: "Чеклист изменен",
    TASK_DELETED: "Задача удалена",
    COLUMN_CHANGED: "Настройки доски изменены",
  };
  return labels[log.action] ?? log.action;
}

function historyTaskLabel(log: any) {
  if (log.task) return `#${log.task.taskNumber} ${log.task.title}`;
  if (log.action === "TASK_DELETED" && log.details?.taskNumber && log.details?.title) {
    return `#${log.details.taskNumber} ${log.details.title}`;
  }
  return "Доска";
}

function historyOilDepotLabel(log: any) {
  return log.task?.oilDepot?.name ?? log.details?.oilDepotName ?? "Без нефтебазы";
}

function activityDetails(log: any) {
  const details = log.details ?? {};
  if (details.previousColumn || details.column) return `Статус: ${details.previousColumn ?? "—"} → ${details.column ?? "—"}`;
  if (details.field === "oilDepot") return `Нефтебаза: ${details.oldValue ?? "без нефтебазы"} → ${details.newValue ?? "без нефтебазы"}`;
  if (details.oldValue !== undefined || details.newValue !== undefined) return `${details.label ?? "Значение"}: ${displayHistoryValue(details.oldValue)} → ${displayHistoryValue(details.newValue)}`;
  if (details.assigneesBefore || details.assigneesAfter) return `Исполнители: ${(details.assigneesBefore ?? []).join(", ") || "не назначены"} → ${(details.assigneesAfter ?? []).join(", ") || "не назначены"}`;
  if (details.action === "created" && details.item) return `Добавлен пункт: «${details.item}»`;
  if (details.action === "deleted" && details.item) return `Удалён пункт: «${details.item}»`;
  if (details.item && typeof details.completed === "boolean") return `${details.completed ? "Выполнен" : "Возвращён"} пункт: «${details.item}»`;
  if (details.fileName) return `Файл: ${details.fileName}${details.size ? ` · ${formatBytes(details.size)}` : ""}`;
  if (details.text) return `Текст: «${String(details.text).slice(0, 160)}»`;
  if (details.archived) return "Заявка сохранена в архиве и доступна для просмотра";
  if (details.deletedPermanently) return "Заявка удалена без возможности восстановления";
  if (details.deadline) return `Новый срок: ${dateTime(details.deadline)}`;
  if (details.title && log.action === "CHECKLIST_CHANGED") return `Создан чек-лист «${details.title}»`;
  return "Без дополнительных значений";
}

function displayHistoryValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "не указано";
  if (Array.isArray(value)) return value.join(", ") || "не указано";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return dateTime(value);
  return String(value).slice(0, 180);
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}
