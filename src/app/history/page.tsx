import { AppShell } from "@/components/AppShell";
import { GlobalHistory } from "@/components/BoardInsights";
import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { getActivityHistory, getHistoryFilterOptions } from "@/lib/board-data";

const activityOptions = [
  ["TASK_CREATED", "Создание задачи"],
  ["TITLE_CHANGED", "Название изменено"],
  ["DESCRIPTION_CHANGED", "Описание изменено"],
  ["STATUS_CHANGED", "Статус изменен"],
  ["PRIORITY_CHANGED", "Приоритет изменен"],
  ["START_DATE_CHANGED", "Дата начала изменена"],
  ["DEADLINE_CHANGED", "Срок изменен"],
  ["ASSIGNEE_CHANGED", "Исполнитель изменен"],
  ["COMMENT_ADDED", "Комментарий добавлен"],
  ["FILE_UPLOADED", "Файл загружен"],
  ["CHECKLIST_CHANGED", "Чеклист изменен"],
  ["TASK_DELETED", "Задача удалена / архив"],
  ["COLUMN_CHANGED", "Настройки доски изменены"],
] as const;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PermissionKey.VIEW_HISTORY);
  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") urlParams.set(key, value);
  }
  const [logs, filterOptions] = await Promise.all([getActivityHistory(urlParams), getHistoryFilterOptions()]);

  const today = new Date();
  const yearAgo = new Date(today);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const from = urlParams.get("from") ?? isoDate(yearAgo);
  const to = urlParams.get("to") ?? isoDate(today);
  const userId = urlParams.get("userId") ?? "";
  const oilDepot = urlParams.get("oilDepot") ?? "";
  const action = urlParams.get("action") ?? "";

  return (
    <AppShell user={user}>
      <div className="content insights-page">
        <section className="page-heading">
          <h1>Общая история</h1>
          <p className="muted">По умолчанию показан журнал за последний год. Можно выбрать любой промежуток дат.</p>
        </section>
        <form className="history-filter panel" action="/history">
          <label className="field">
            <span className="label">С даты</span>
            <input className="input" type="date" name="from" defaultValue={from} />
          </label>
          <label className="field">
            <span className="label">До даты</span>
            <input className="input" type="date" name="to" defaultValue={to} />
          </label>
          <label className="field">
            <span className="label">Пользователь</span>
            <select className="select" name="userId" defaultValue={userId}>
              <option value="">Все люди</option>
              {filterOptions.users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.email}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Нефтебаза</span>
            <select className="select" name="oilDepot" defaultValue={oilDepot}>
              <option value="">Все нефтебазы</option>
              <option value="__none">Без нефтебазы</option>
              {filterOptions.oilDepots.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.active ? "" : " (неактивна)"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Действие</span>
            <select className="select" name="action" defaultValue={action}>
              <option value="">Все действия</option>
              {activityOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button">Показать</button>
          <a className="button secondary" href="/history">
            За год
          </a>
        </form>
        <GlobalHistory logs={JSON.parse(JSON.stringify(logs))} />
      </div>
    </AppShell>
  );
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
