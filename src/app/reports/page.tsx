import { Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ReportsPanel } from "@/components/BoardInsights";
import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { getReportsData } from "@/lib/board-data";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PermissionKey.VIEW_REPORTS);
  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") urlParams.set(key, value);
  }
  const reports = await getReportsData(urlParams);
  const quickLinks = buildReportQuickLinks(reports.selected.year);

  return (
    <AppShell user={user}>
      <div className="content insights-page">
        <section className="page-heading reports-page-heading">
          <div>
            <h1>Дашборд</h1>
            <p className="muted">Приоритеты, сроки и загрузка команды в одном отчёте.</p>
          </div>
          <a className="button secondary reports-export-button" href="/api/export">
            <Download size={16} />
            Экспорт в Excel
          </a>
        </section>
        <form className="reports-filter panel" action="/reports">
          <label className="field">
            <span className="label">Год</span>
            <select className="select" name="year" defaultValue={String(reports.selected.year)}>
              {reports.selected.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">С даты</span>
            <input className="input" type="date" name="from" defaultValue={reports.selected.from} />
          </label>
          <label className="field">
            <span className="label">До даты</span>
            <input className="input" type="date" name="to" defaultValue={reports.selected.to} />
          </label>
          <input type="hidden" name="mode" value="period" />
          <div className="reports-period-actions" aria-label="Быстрый выбор периода">
            {quickLinks.map((link) => (
              <a className={link.kind === reports.selected.mode ? "active" : ""} href={link.href} key={link.kind}>
                {link.label}
              </a>
            ))}
          </div>
          <button className="button">Показать</button>
          <a className="button secondary" href="/reports">
            Текущий год
          </a>
        </form>
        <ReportsPanel reports={JSON.parse(JSON.stringify(reports))} />
      </div>
    </AppShell>
  );
}

function buildReportQuickLinks(year: number) {
  const now = new Date();
  const base = now.getFullYear() === year ? now : new Date(year, 0, 1);
  const weekStart = new Date(base);
  weekStart.setDate(base.getDate() - 6);
  const monthStart = new Date(year, base.getMonth(), 1);
  const monthEnd = new Date(year, base.getMonth() + 1, 0);
  const quarterStartMonth = Math.floor(base.getMonth() / 3) * 3;
  const quarterStart = new Date(year, quarterStartMonth, 1);
  const quarterEnd = new Date(year, quarterStartMonth + 3, 0);

  return [
    { kind: "week", label: "Неделя", href: reportHref(year, weekStart, base, "week") },
    { kind: "month", label: "Месяц", href: reportHref(year, monthStart, monthEnd, "month") },
    { kind: "quarter", label: "Квартал", href: reportHref(year, quarterStart, quarterEnd, "quarter") },
    { kind: "year", label: "Год", href: reportHref(year, new Date(year, 0, 1), new Date(year, 11, 31), "year") },
  ];
}

function reportHref(year: number, from: Date, to: Date, mode: string) {
  const params = new URLSearchParams({
    year: String(year),
    from: formatDate(from),
    to: formatDate(to),
    mode,
  });
  return `/reports?${params.toString()}`;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
