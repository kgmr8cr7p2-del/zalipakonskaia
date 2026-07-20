"use client";

import { BarChart3, CheckCircle2, Clock3, CloudSun, Flame, ListChecks, Minimize2, Newspaper, PieChart, Radio, Smile, Target, TimerReset, TrendingUp, Wind } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { TaskSoundNotifier } from "@/components/TaskSoundNotifier";
import { GoidaReminder } from "@/components/GoidaReminder";
import { WeeklyReportReminder } from "@/components/WeeklyReportReminder";

type View = any;
type Task = any;
type Weather = any;

const priorityLabels = {
  LOW: "Низкий",
  PLANNED: "Плановые работы",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  CRITICAL: "Критический",
};

const officeWeatherLocation = {
  name: "Санкт-Петербург",
  address: "Конногвардейский бульвар, 4",
  latitude: 59.9329,
  longitude: 30.2991,
};

const standbyTimeZones = [
  { city: "Санкт-Петербург", label: "офис", timeZone: "Europe/Moscow" },
  { city: "Омск", label: "+3 к МСК", timeZone: "Asia/Omsk" },
  { city: "Челябинск", label: "+2 к МСК", timeZone: "Asia/Yekaterinburg" },
  { city: "Тобольск", label: "+2 к МСК", timeZone: "Asia/Yekaterinburg" },
];

const weatherLabels: Record<number, string> = {
  0: "Ясно",
  1: "Преимущественно ясно",
  2: "Переменная облачность",
  3: "Пасмурно",
  45: "Туман",
  48: "Изморозь",
  51: "Легкая морось",
  53: "Морось",
  55: "Сильная морось",
  61: "Небольшой дождь",
  63: "Дождь",
  65: "Сильный дождь",
  71: "Небольшой снег",
  73: "Снег",
  75: "Сильный снег",
  80: "Кратковременный дождь",
  81: "Ливень",
  82: "Сильный ливень",
  95: "Гроза",
};

const officeJokes = [
  "Админ не опаздывает. Он синхронизируется с серверным временем.",
  "Если задача закрыта без комментария, значит комментарий был слишком эмоциональным.",
  "Самый стабильный процесс в офисе - это очередь к кофемашине.",
  "Хороший дедлайн видно издалека. Просроченный - с телевизора.",
  "Планерка прошла успешно: все задачи получили новые задачи.",
];

type TvJoke = {
  text: string;
  sourceUrl: string | null;
  updatedAt: string;
};

type TvNews = {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string;
  shownAt: string;
  nextRefreshAt: string;
  stale: boolean;
};

type TvTaskSnapshot = {
  signature: string;
  title: string;
  columnId: string;
  columnName: string;
  priority: string;
  deadline: string;
  assigneeNames: string;
  commentsCount: number;
  filesCount: number;
  checklistDone: number;
  checklistTotal: number;
};

type TvTaskSpotlight = {
  id: string;
  kind: "created" | "updated";
  task: Task;
  changes: string[];
};

type TvMode = "standby" | "news" | "tasks" | "jokes" | "focus";

const tvModes: Array<{ id: TvMode; label: string }> = [
  { id: "standby", label: "Standby" },
  { id: "news", label: "Новости" },
  { id: "tasks", label: "Задачи" },
  { id: "jokes", label: "Анекдоты" },
  { id: "focus", label: "Фокус дня" },
];

const FEATURE_HOLD_MS = 60 * 1000;
const MANUAL_HOLD_MS = 2 * 60 * 1000;
const AUTO_ROTATION_MS = 3 * 60 * 1000;
const TASK_SPOTLIGHT_MS = 9000;

export function BoardTvClient({ initialView, initialNews = null, initialNow }: { initialView: View; initialNews?: TvNews | null; initialNow: string }) {
  const [view, setView] = useState(initialView);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [now, setNow] = useState(() => new Date(initialNow));
  const [joke, setJoke] = useState<TvJoke>({ text: officeJokes[0], sourceUrl: null, updatedAt: "fallback" });
  const [news, setNews] = useState<TvNews | null>(initialNews);
  const [newsHistory, setNewsHistory] = useState<TvNews[]>([]);
  const [jokeHistory, setJokeHistory] = useState<TvJoke[]>([]);
  const [tvMode, setTvMode] = useState<TvMode>("standby");
  const [visibleTaskLimit, setVisibleTaskLimit] = useState(5);
  const [manualModeUntil, setManualModeUntil] = useState(0);
  const [newsUnavailable, setNewsUnavailable] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date(initialNow));
  const [connectionState, setConnectionState] = useState<"live" | "stale">("live");
  const [taskSpotlight, setTaskSpotlight] = useState<TvTaskSpotlight | null>(null);
  const previousNewsRef = useRef<TvNews | null>(initialNews);
  const previousJokeRef = useRef<TvJoke | null>(null);
  const taskSnapshotRef = useRef(buildTaskSnapshot(initialView));
  const featureReturnTimerRef = useRef<number | null>(null);
  const taskSpotlightTimerRef = useRef<number | null>(null);

  const tasks = useMemo(() => view?.board?.columns?.flatMap((column: any) => column.tasks) ?? [], [view]);
  const summary = useMemo(() => buildSummary(tasks, view), [tasks, view]);
  const cleanNews = useMemo(() => news ? { ...news, summary: cleanNewsText(news.summary) } : null, [news]);
  const cleanNewsHistory = useMemo(() => newsHistory.map((item) => ({ ...item, summary: cleanNewsText(item.summary) })), [newsHistory]);
  const activeModeIndex = tvModes.findIndex((mode) => mode.id === tvMode);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function syncVisibleTaskLimit() {
      const shortLandscape = window.innerHeight <= 820 && window.innerWidth > 720;
      setVisibleTaskLimit(shortLandscape ? 7 : 9);
    }

    syncVisibleTaskLimit();
    window.addEventListener("resize", syncVisibleTaskLimit);
    return () => window.removeEventListener("resize", syncVisibleTaskLimit);
  }, []);

  useEffect(() => {
    void refreshJoke();
    const timer = window.setInterval(() => void refreshJoke(), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void refreshWeather();
    const timer = window.setInterval(() => void refreshWeather(), 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void refreshNews();
    const timer = window.setInterval(() => void refreshNews(), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!news?.id) return;
    const previousNews = previousNewsRef.current;
    if (!previousNews) {
      previousNewsRef.current = news;
      return;
    }
    if (previousNews.id === news.id) {
      previousNewsRef.current = news;
      return;
    }

    setNewsHistory((items) => prependNewsHistory(previousNews, items));
    previousNewsRef.current = news;
    showTemporaryMode("news");
  }, [news]);

  useEffect(() => {
    if (!joke.updatedAt || joke.updatedAt === "fallback") return;
    const previousJoke = previousJokeRef.current;
    if (!previousJoke) {
      previousJokeRef.current = joke;
      return;
    }
    if (previousJoke.updatedAt === joke.updatedAt) return;

    if (previousJoke.updatedAt !== "fallback") {
      setJokeHistory((items) => prependJokeHistory(previousJoke, items));
    }
    previousJokeRef.current = joke;
    showTemporaryMode("jokes");
  }, [joke]);

  useEffect(() => {
    return () => {
      clearFeatureReturnTimer();
      clearTaskSpotlightTimer();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setTvMode((current) => nextTvMode(current, 1));
        holdManualMode();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setTvMode((current) => nextTvMode(current, -1));
        holdManualMode();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (Date.now() < manualModeUntil) return;
      setTvMode((current) => nextTvMode(current, 1));
    }, AUTO_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [manualModeUntil]);

  useEffect(() => {
    const timer = window.setInterval(() => void refreshBoard(), 15 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function refreshBoard() {
    try {
      const response = await fetch("/api/board");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Board refresh failed");
      detectTaskSpotlight(data);
      setView(data);
      setLastUpdatedAt(new Date());
      setConnectionState("live");
    } catch {
      setConnectionState("stale");
    }
  }

  async function refreshWeather() {
    const response = await fetch("/api/weather/office");
    const data = await response.json().catch(() => null);
    if (data && !data.unavailable) {
      setWeather(data);
      return;
    }

    const direct = await fetchOfficeWeatherDirect().catch(() => data);
    if (direct) setWeather(direct);
  }

  async function refreshNews() {
    try {
      const response = await fetch(`/api/tv-news?at=${Date.now()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.title) throw new Error(data.error ?? "News refresh failed");
      setNews(data);
      setNewsUnavailable(false);
    } catch {
      setNewsUnavailable(true);
      setNews((current) => current ? { ...current, stale: true, nextRefreshAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() } : current);
    }
  }

  async function exitTvMode() {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
    window.location.href = "/board";
  }

  async function refreshJoke() {
    try {
      const response = await fetch(`/api/jokes/random?at=${Date.now()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.joke) throw new Error(data.error ?? "Joke refresh failed");
      setJoke({ text: data.joke, sourceUrl: null, updatedAt: data.updatedAt ?? String(Date.now()) });
    } catch {
      setJoke((current) => {
        if (current.sourceUrl) return current;
        const currentIndex = Math.max(0, officeJokes.indexOf(current.text));
        return { text: officeJokes[(currentIndex + 1) % officeJokes.length], sourceUrl: null, updatedAt: String(Date.now()) };
      });
    }
  }

  function clearFeatureReturnTimer() {
    if (featureReturnTimerRef.current === null) return;
    window.clearTimeout(featureReturnTimerRef.current);
    featureReturnTimerRef.current = null;
  }

  function clearTaskSpotlightTimer() {
    if (taskSpotlightTimerRef.current === null) return;
    window.clearTimeout(taskSpotlightTimerRef.current);
    taskSpotlightTimerRef.current = null;
  }

  function holdManualMode() {
    clearFeatureReturnTimer();
    setManualModeUntil(Date.now() + MANUAL_HOLD_MS);
  }

  function showTemporaryMode(mode: TvMode) {
    clearFeatureReturnTimer();
    setTvMode(mode);
    setManualModeUntil(Date.now() + FEATURE_HOLD_MS);
    featureReturnTimerRef.current = window.setTimeout(() => {
      setTvMode("standby");
      setManualModeUntil(0);
      featureReturnTimerRef.current = null;
    }, FEATURE_HOLD_MS);
  }

  function detectTaskSpotlight(nextView: View) {
    const previousSnapshot = taskSnapshotRef.current;
    const nextSnapshot = buildTaskSnapshot(nextView);
    taskSnapshotRef.current = nextSnapshot;

    const candidates: TvTaskSpotlight[] = [];
    for (const [taskId, nextItem] of nextSnapshot) {
      const previousItem = previousSnapshot.get(taskId);
      if (!previousItem) {
        const task = findTaskById(nextView, taskId);
        if (task) candidates.push({ id: `${taskId}:created:${task.updatedAt ?? Date.now()}`, kind: "created", task, changes: ["Новая задача на доске"] });
        continue;
      }
      if (previousItem.signature !== nextItem.signature) {
        const task = findTaskById(nextView, taskId);
        if (task) candidates.push({ id: `${taskId}:updated:${task.updatedAt ?? Date.now()}:${nextItem.signature}`, kind: "updated", task, changes: describeTaskSnapshotChanges(previousItem, nextItem) });
      }
    }

    const spotlight = candidates.at(-1);
    if (!spotlight) return;
    showTaskSpotlight(spotlight);
  }

  function showTaskSpotlight(spotlight: TvTaskSpotlight) {
    clearFeatureReturnTimer();
    clearTaskSpotlightTimer();
    setTvMode("tasks");
    setManualModeUntil(Date.now() + TASK_SPOTLIGHT_MS + 3000);
    setTaskSpotlight(spotlight);
    taskSpotlightTimerRef.current = window.setTimeout(() => {
      setTaskSpotlight(null);
      taskSpotlightTimerRef.current = null;
    }, TASK_SPOTLIGHT_MS);
  }

  return (
    <main className={`tv-page tv-mode-${tvMode}`}>
      <button className="button focus-exit tv-exit" type="button" onClick={() => void exitTvMode()}>
        <Minimize2 size={17} />
        Выйти из просмотра
      </button>
      {tvMode === "standby" || tvMode === "jokes" ? null : <header className="tv-hero">
        <section className="tv-title-block">
          <span className={connectionState === "live" ? "tv-live-pill" : "tv-live-pill tv-live-stale"}>
            <Radio size={16} />
            {connectionState === "live" ? "LIVE-синхронизация" : "Нет связи"}
          </span>
          <h1>Операционная доска</h1>
          <div className="tv-compact-stats">
            <span>Активно {summary.active}</span>
            <span>В работе {summary.inProgress}</span>
            <span>Просрочено {summary.overdue}</span>
            <span>Критические {summary.critical}</span>
          </div>
        </section>

        <section className="tv-clock-card" aria-label="Время">
          <strong>{timeOnly(now)}</strong>
          <span>{dateLong(now)}</span>
        </section>

        <WeatherPanel weather={weather} />

        <section className="tv-joke-card" aria-label="Случайный анекдот" aria-live="polite">
          <strong key={joke.updatedAt}>{joke.text}</strong>
        </section>
      </header>}

      <nav className="tv-mode-bar" aria-label="Режим TV-дашборда">
        <div className="tv-mode-current">
          <span>Taskora TV</span>
          <strong>{String(activeModeIndex + 1).padStart(2, "0")} · {tvModes[activeModeIndex]?.label}</strong>
        </div>
        <div className="tv-mode-switcher">
          {tvModes.map((mode, index) => {
            const Icon = tvModeIcon(mode.id);
            return (
              <button className={tvMode === mode.id ? "is-active" : ""} type="button" key={mode.id} onClick={() => { setTvMode(mode.id); holdManualMode(); }}>
                <small>{String(index + 1).padStart(2, "0")}</small>
                <Icon size={16} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
        <div className="tv-mode-meter" aria-hidden="true">
          {tvModes.map((mode) => <span className={tvMode === mode.id ? "is-active" : ""} key={mode.id} />)}
        </div>
      </nav>

      <section className="tv-layout">
        {tvMode === "standby" ? <TvStandby now={now} weather={weather} news={cleanNews} newsUnavailable={newsUnavailable} summary={summary} tasks={tasks} activityLogs={view?.activityLogs ?? []} /> : null}
        {tvMode === "news" ? <TvNewsReader news={cleanNews} history={cleanNewsHistory} unavailable={newsUnavailable} now={now} /> : null}
        {tvMode === "tasks" ? (
          <TvOperationsBoard columns={view?.board?.columns ?? []} summary={summary} tasks={tasks} now={now} visibleTaskLimit={visibleTaskLimit} />
        ) : null}
        {tvMode === "jokes" ? <TvJokeStage joke={joke} history={jokeHistory} now={now} weather={weather} /> : null}
        {tvMode === "focus" ? <TvFocusDashboard tasks={tasks} summary={summary} /> : null}
      </section>

      <footer className="tv-footer">
        <span>Обновлено {timeOnly(lastUpdatedAt)}</span>
        <span>{view?.board?.name ?? "Taskora"}</span>
        <span>← → режимы</span>
      </footer>
      <TaskSoundNotifier />
      <GoidaReminder />
      <WeeklyReportReminder />
      {taskSpotlight ? <TvTaskSpotlightOverlay spotlight={taskSpotlight} /> : null}
    </main>
  );
}

function TvOperationsBoard({ columns, summary, tasks, now, visibleTaskLimit }: { columns: any[]; summary: ReturnType<typeof buildSummary>; tasks: Task[]; now: Date; visibleTaskLimit: number }) {
  const completedPercent = summary.active + summary.completed ? Math.round((summary.completed / (summary.active + summary.completed)) * 100) : 0;
  const activeTasks = tasks.filter((task) => !isCompletedColumn(task.column?.name ?? ""));
  const dueSoonCount = activeTasks.filter((task) => isDueSoon(task)).length;
  const teamCount = new Set(tasks.flatMap((task) => taskAssignees(task).map((user: any) => user.id ?? user.name))).size;
  const nextDeadline = [...activeTasks]
    .filter((task) => task.deadline && !isCompletedColumn(task.column?.name ?? ""))
    .sort((a, b) => deadlineTime(a) - deadlineTime(b))[0];
  const pressure = Math.min(100, summary.active ? Math.round(((summary.overdue * 2 + summary.critical + dueSoonCount) / Math.max(1, summary.active)) * 34) : 0);
  const focusQueue = buildFocusQueue(tasks).slice(0, 3);

  return (
    <section className="tv-ops-screen" aria-label="Операционная канбан-доска">
      <header className="tv-ops-command" aria-label="Сводка смены">
        <div className="tv-ops-command-main">
          <span>SHIFT {timeOnly(now)}</span>
          <strong>Нагрузка {pressure}%</strong>
          <meter min={0} max={100} value={pressure} />
        </div>
        <TvOpsMetric icon={<ListChecks size={18} />} label="Активно" value={summary.active} tone="blue" />
        <TvOpsMetric icon={<Flame size={18} />} label="Критично" value={summary.critical} tone="red" />
        <TvOpsMetric icon={<TimerReset size={18} />} label="До 3 дней" value={dueSoonCount} tone="amber" />
        <TvOpsMetric icon={<CheckCircle2 size={18} />} label="Готово" value={`${completedPercent}%`} tone="green" />
        <div className="tv-ops-next">
          <span>Ближайший срок</span>
          <strong>{nextDeadline ? `#${nextDeadline.taskNumber} ${nextDeadline.title}` : "Нет ближайших сроков"}</strong>
          <small>{nextDeadline?.deadline ? `${dateShort(nextDeadline.deadline)} · ${nextDeadline.oilDepot?.name ?? "Без нефтебазы"}` : `Команда: ${teamCount || "-"}`}</small>
        </div>
      </header>

      <section className="tv-board" aria-label="Канбан-доска для телевизора">
        {columns.map((column: any) => (
          <article className={`tv-column${isCompletedColumn(column.name) ? " tv-column-done" : ""}`} key={column.id}>
            <header>
              <span>{column.name}</span>
              <b>{column.tasks.length}</b>
            </header>
            <div className="tv-column-signal">
              <span>CRIT {column.tasks.filter((task: Task) => task.priority === "CRITICAL").length}</span>
              <span>OVERDUE {column.tasks.filter((task: Task) => isOverdue(task)).length}</span>
            </div>
            <div className="tv-task-list">
              {column.tasks.slice(0, visibleTaskLimit).map((task: Task) => (
                <TvTaskRow key={task.id} task={task} />
              ))}
              {column.tasks.length > visibleTaskLimit ? <div className="tv-more-card">+{column.tasks.length - visibleTaskLimit} еще</div> : null}
              {!column.tasks.length ? <div className="tv-empty-column">Нет задач</div> : null}
            </div>
          </article>
        ))}
      </section>

      <aside className="tv-ops-focus-strip" aria-label="Ближайшие действия">
        <span>Ближайшие действия</span>
        {focusQueue.length ? focusQueue.map((item, index) => (
          <div className={`tv-focus-strip-row tv-focus-strip-${item.tone}`} key={item.task.id}>
            <b>{index + 1}</b>
            <strong>#{item.task.taskNumber} {item.task.title}</strong>
            <small>{item.reason} · {taskOwnerLabel(item.task)}</small>
          </div>
        )) : <strong>Нет срочных задач</strong>}
      </aside>
    </section>
  );
}

function TvOpsMetric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number | string; tone: "blue" | "green" | "amber" | "red" }) {
  return (
    <div className={`tv-ops-metric tv-ops-metric-${tone}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WeatherPanel({ weather }: { weather: Weather | null }) {
  if (!weather) {
    return (
      <section className="tv-weather-card">
        <CloudSun size={24} />
        <div>
          <strong>Погода загружается</strong>
          <span>Санкт-Петербург · Конногвардейский бульвар, 4</span>
        </div>
      </section>
    );
  }

  return (
    <section className="tv-weather-card" aria-label="Погода в офисе">
      <CloudSun size={28} />
      <div>
        <strong>{weather.unavailable ? "Погода недоступна" : `${signed(weather.temperature)}°C · ${weather.summary}`}</strong>
        <span>
          {weather.office.name} · {weather.office.address}
        </span>
        {!weather.unavailable ? (
          <small>
            ощущается {signed(weather.apparentTemperature)}° · <Wind size={13} /> {weather.windSpeed} м/с
            {weather.nextPrecipitation ? ` · ${weather.nextPrecipitation.summary.toLowerCase()} ${hourOnly(weather.nextPrecipitation.time)}` : " · осадки не ожидаются"}
          </small>
        ) : null}
      </div>
    </section>
  );
}

function StandbyWeatherPanel({ weather }: { weather: Weather | null }) {
  if (!weather || weather.unavailable) {
    return (
      <section className="tv-standby-weather-card" aria-label="Погода">
        <header>
          <span><CloudSun size={18} /> Погода</span>
          <small>{weather?.updatedAt ? `обновлено ${hourOnly(weather.updatedAt)}` : "загрузка"}</small>
        </header>
        <div className="tv-standby-weather-empty">
          <strong>{weather?.unavailable ? "Погода недоступна" : "Погода загружается"}</strong>
          <span>Санкт-Петербург · Конногвардейский бульвар, 4</span>
        </div>
      </section>
    );
  }

  const tomorrow = weather.tomorrow;
  const hours = Array.isArray(weather.hourlyForecast) ? weather.hourlyForecast.slice(0, 4) : [];

  return (
    <section className="tv-standby-weather-card" aria-label="Погода в офисе">
      <header>
        <span><CloudSun size={18} /> Погода</span>
        <small>обновлено {hourOnly(weather.updatedAt)}</small>
      </header>
      <div className="tv-standby-weather-now">
        <CloudSun size={34} />
        <div>
          <strong>{signed(weather.temperature)}°C</strong>
          <span>{weather.summary}</span>
          <small>ощущается {signed(weather.apparentTemperature)}° · ветер {weather.windSpeed} м/с</small>
        </div>
      </div>
      <div className="tv-standby-weather-facts">
        <span>
          <small>порывы</small>
          <b>{weather.windGusts ?? weather.windSpeed} м/с</b>
        </span>
        <span>
          <small>осадки</small>
          <b>{weather.nextPrecipitation ? `${weather.nextPrecipitation.probability}% в ${hourOnly(weather.nextPrecipitation.time)}` : "не ждём"}</b>
        </span>
        <span>
          <small>адрес</small>
          <b>{weather.office?.name ?? "Санкт-Петербург"}</b>
        </span>
      </div>
      <div className="tv-standby-weather-hours">
        {hours.length ? hours.map((item: any) => (
          <span key={item.time}>
            <small>{hourOnly(item.time)}</small>
            <b>{signed(item.temperature)}°</b>
            <em>{item.probability}%</em>
          </span>
        )) : null}
      </div>
      <div className="tv-standby-weather-tomorrow">
        <small>Завтра</small>
        <strong>{tomorrow ? `${signed(tomorrow.temperatureMin)}...${signed(tomorrow.temperatureMax)}° · ${tomorrow.summary}` : "прогноз обновляется"}</strong>
        <span>{tomorrow ? `осадки ${tomorrow.probability ?? 0}% · ${Number(tomorrow.precipitation ?? 0).toFixed(1)} мм` : "данные появятся после обновления"}</span>
      </div>
    </section>
  );
}

function TvStandby({ now, weather, news, newsUnavailable, summary, tasks, activityLogs }: { now: Date; weather: Weather | null; news: TvNews | null; newsUnavailable: boolean; summary: ReturnType<typeof buildSummary>; tasks: Task[]; activityLogs: any[] }) {
  const activeTasks = tasks.filter((task) => !isCompletedColumn(task.column?.name ?? ""));
  const recentFocus = buildRecentActionFocus(tasks, activityLogs).slice(0, 6);
  const chartData = buildTvActivityChart(tasks, activityLogs);
  const statusRows = buildStatusRows(tasks);
  const depotRows = buildDepotRows(activeTasks).slice(0, 5);
  const completion = tasks.length ? Math.round((summary.completed / tasks.length) * 100) : 0;
  const updatedToday = activityLogs.filter((log) => isSameCalendarDay(log.createdAt, now)).length || tasks.filter((task) => isSameCalendarDay(task.updatedAt, now)).length;

  return (
    <section className="tv-standby tv-standby-wall" aria-label="Стендбай">
      <article className="tv-wall-clock">
        <span>Taskora TV</span>
        <strong>{timeOnly(now)}</strong>
        <small>{dateLong(now)}</small>
        <div className="tv-wall-clock-stats">
          <span><b>{summary.active}</b>активно</span>
          <span><b>{summary.overdue}</b>просрочено</span>
          <span><b>{updatedToday}</b>действий сегодня</span>
        </div>
        <div className="tv-wall-timezones">
          {standbyTimeZones.map((zone) => (
            <span key={zone.city}>
              <small>{zone.city}</small>
              <b>{cityTime(now, zone.timeZone)}</b>
              <em>{zone.label}</em>
            </span>
          ))}
        </div>
      </article>

      <article className="tv-wall-news">
        <span><Newspaper size={18} /> Главная новость</span>
        <strong>{news?.title ?? (newsUnavailable ? "Новости временно недоступны" : "Загружаем главную новость")}</strong>
        {news?.summary ? <p>{news.summary}</p> : <p>Экран обновится автоматически, когда источник ответит.</p>}
      </article>

      <article className="tv-wall-weather">
        <StandbyWeatherPanel weather={weather} />
      </article>

      <article className="tv-wall-report tv-wall-panel">
        <header>
          <span><TrendingUp size={17} /> Отчётный пояс</span>
          <small>динамика · статусы · прогресс · нефтебазы</small>
        </header>
        <div className="tv-wall-report-grid">
          <section className="tv-report-chart" aria-label="Динамика недели">
            <span><BarChart3 size={15} /> Неделя</span>
            <TvMiniLineChart data={chartData} />
          </section>
          <section className="tv-report-status" aria-label="Статусы задач">
            <span><PieChart size={15} /> Статусы</span>
            <TvStatusDonut rows={statusRows} total={Math.max(1, tasks.length)} />
          </section>
          <section className="tv-report-progress" aria-label="Прогресс и нефтебазы">
            <span><CheckCircle2 size={15} /> Прогресс</span>
            <div className="tv-wall-gauge" style={{ "--tv-gauge": `${completion}%` } as CSSProperties}>
              <strong>{completion}%</strong>
              <small>готово</small>
            </div>
            <div className="tv-wall-depots">
              {depotRows.map((row) => (
                <span key={row.name}>
                  <small>{row.name}</small>
                  <i style={{ inlineSize: `${row.percent}%` }} />
                  <b>{row.count}</b>
                </span>
              ))}
            </div>
          </section>
        </div>
      </article>

      <article className="tv-wall-focus tv-wall-panel">
        <header>
          <span><Target size={17} /> Последние действия в фокусе</span>
          <small>задачи, которые недавно менялись</small>
        </header>
        <div>
          {recentFocus.length ? recentFocus.map((item) => <TvRecentFocusRow item={item} key={`${item.task.id}-${item.updatedAt}`} />) : <strong>За последнее время изменений нет</strong>}
        </div>
      </article>
    </section>
  );
}

function TvNewsReader({ news, history, unavailable, now }: { news: TvNews | null; history: TvNews[]; unavailable: boolean; now: Date }) {
  return (
    <section className="tv-news-reader" aria-label="Новости">
      <article className="tv-news-reader-card">
        <span className="tv-reader-kicker"><Newspaper size={18} /> Дзен Новости</span>
        {news ? (
          <>
            <h2>{news.title}</h2>
            <p>{news.summary || "Краткое описание недоступно. Подробности можно открыть в источнике."}</p>
            <div className="tv-reader-meta">
              <span>{nextNewsRefreshLabel(news.nextRefreshAt, now, news.stale)}</span>
              <a href={news.sourceUrl} target="_blank" rel="noreferrer">Источник</a>
            </div>
          </>
        ) : (
          <>
            <h2>{unavailable ? "Новости временно недоступны" : "Загружаем главную новость"}</h2>
            <p>Экран обновится автоматически, когда источник ответит.</p>
          </>
        )}
      </article>
      <TvNewsHistory items={history} />
    </section>
  );
}

type TvChartPoint = {
  label: string;
  created: number;
  updated: number;
  completed: number;
};

type TvChartCoordinate = {
  x: number;
  y: number;
};

type TvStatusRow = {
  name: string;
  count: number;
  color: string;
  percent: number;
};

type TvRecentFocus = {
  task: Task;
  action: string;
  actor: string;
  updatedAt: string;
  tone: "red" | "amber" | "blue" | "green";
};

const tvChartColors = ["#60a5fa", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#22d3ee"];
const tvChartTop = 8;
const tvChartBottom = 92;

function TvMiniLineChart({ data }: { data: TvChartPoint[] }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.created, item.updated, item.completed]));
  const ticks = buildTvChartTicks(max);
  const totals = data.reduce((sum, item) => ({
    created: sum.created + item.created,
    updated: sum.updated + item.updated,
    completed: sum.completed + item.completed,
  }), { created: 0, updated: 0, completed: 0 });
  const created = chartCoordinates(data.map((item) => item.created), max);
  const updated = chartCoordinates(data.map((item) => item.updated), max);
  const completed = chartCoordinates(data.map((item) => item.completed), max);

  return (
    <figure className="tv-mini-chart">
      <div className="tv-mini-chart-body">
        <div className="tv-mini-chart-y-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick.value} style={{ "--tick-y": `${tick.y}%` } as CSSProperties}>{tick.value}</span>
          ))}
        </div>
        <div className="tv-mini-chart-plot">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="tvMiniCreatedFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity=".18" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((tick) => <line className="tv-mini-chart-grid" key={tick.value} x1="0" x2="100" y1={tick.y} y2={tick.y} />)}
            <path className="tv-mini-chart-area" d={pointsToAreaPath(created)} />
            <path className="tv-mini-chart-created" d={pointsToMonotonePath(created)} />
            <path className="tv-mini-chart-updated" d={pointsToMonotonePath(updated)} />
            <path className="tv-mini-chart-completed" d={pointsToMonotonePath(completed)} />
          </svg>
          <div className="tv-mini-chart-days">
            {data.map((item) => <span key={item.label}>{item.label}</span>)}
          </div>
        </div>
      </div>
      <div className="tv-mini-chart-legend">
        <span className="tv-mini-legend-created"><b>{totals.created}</b>создано</span>
        <span className="tv-mini-legend-updated"><b>{totals.updated}</b>обновлено</span>
        <span className="tv-mini-legend-completed"><b>{totals.completed}</b>закрыто</span>
      </div>
    </figure>
  );
}

function TvStatusDonut({ rows, total }: { rows: TvStatusRow[]; total: number }) {
  let cursor = 0;
  const gradient = rows.length
    ? `conic-gradient(${rows.map((row) => {
        const start = cursor;
        cursor += row.percent;
        return `${row.color} ${start}% ${cursor}%`;
      }).join(", ")})`
    : "conic-gradient(#334155 0 100%)";

  return (
    <div className="tv-status-donut-wrap">
      <div className="tv-status-donut" style={{ "--tv-donut": gradient } as CSSProperties}>
        <span>{total}</span>
      </div>
      <div className="tv-status-list">
        {rows.map((row) => (
          <span key={row.name}>
            <i style={{ background: row.color }} />
            <small>{row.name}</small>
            <b>{row.count}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function TvRecentFocusRow({ item }: { item: TvRecentFocus }) {
  return (
    <article className={`tv-recent-focus-row tv-recent-focus-${item.tone}`}>
      <time>{relativeTimeLabel(item.updatedAt)}</time>
      <div>
        <strong>#{item.task.taskNumber} {item.task.title}</strong>
        <span>{item.action} · {item.actor} · {item.task.column?.name ?? "Без статуса"}</span>
      </div>
      <small>{taskRiskLabel(item.task)}</small>
    </article>
  );
}

function TvNewsHistory({ items }: { items: TvNews[] }) {
  return (
    <aside className="tv-broadcast-history tv-news-history" aria-label="Предыдущие новости">
      <header><span><Newspaper size={16} /> Ранее в новостях</span></header>
      <div>
        {items.length ? items.slice(0, 4).map((item) => (
          <article key={item.id}>
            <time>{hourOnly(item.shownAt)}</time>
            <strong>{item.title}</strong>
            <span>{item.summary || "Краткое описание недоступно."}</span>
          </article>
        )) : <p>Предыдущие новости появятся после следующего обновления ленты.</p>}
      </div>
    </aside>
  );
}

function TvJokeStage({ joke, history, now, weather }: { joke: TvJoke; history: TvJoke[]; now: Date; weather: Weather | null }) {
  return (
    <section className="tv-joke-stage" aria-label="Анекдоты">
      <article className="tv-joke-stage-card">
        <span><Smile size={22} /> Перерыв в эфире</span>
        <strong key={joke.updatedAt}>{joke.text}</strong>
      </article>
      <aside className="tv-joke-stage-side">
        <div>
          <span>{dateLong(now)}</span>
          <strong>{timeOnly(now)}</strong>
        </div>
        <WeatherPanel weather={weather} />
      </aside>
      <TvJokeHistory items={history} />
    </section>
  );
}

function TvJokeHistory({ items }: { items: TvJoke[] }) {
  return (
    <aside className="tv-broadcast-history tv-joke-history" aria-label="Предыдущие анекдоты">
      <header><span><Smile size={16} /> Ранее в анекдотах</span></header>
      <div>
        {items.length ? items.slice(0, 4).map((item) => (
          <article key={`${item.updatedAt}-${item.text}`}>
            <time>{hourOnly(item.updatedAt)}</time>
            <strong>{item.text}</strong>
          </article>
        )) : <p>Предыдущие анекдоты появятся после следующего обновления.</p>}
      </div>
    </aside>
  );
}

function TvFocusDashboard({ tasks, summary }: { tasks: Task[]; summary: ReturnType<typeof buildSummary> }) {
  const focusQueue = buildFocusQueue(tasks).slice(0, 12);

  return (
    <section className="tv-focus-dashboard" aria-label="Фокус дня">
      <article className="tv-dashboard-hero tv-dashboard-critical">
        <Target size={30} />
        <div>
          <strong>Фокус дня: очередь действий</strong>
          <span>{summary.overdue} просрочено · {summary.critical} критично · {summary.inProgress} в работе · закрытые задачи исключены</span>
        </div>
      </article>
      <div className="tv-focus-queue">
        {focusQueue.length ? focusQueue.map((item, index) => <TvFocusRow item={item} index={index} key={item.task.id} />) : <div className="tv-empty-column">Срочных задач нет</div>}
      </div>
    </section>
  );
}

type TvFocusItem = {
  task: Task;
  reason: string;
  score: number;
  tone: "red" | "amber" | "blue" | "green";
};

function TvFocusRow({ item, index, compact = false }: { item: TvFocusItem; index: number; compact?: boolean }) {
  const task = item.task;
  return (
    <article className={`tv-focus-row tv-focus-row-${item.tone}${compact ? " tv-focus-row-compact" : ""}`}>
      <b>{index + 1}</b>
      <div>
        <strong>#{task.taskNumber} {task.title}</strong>
        <span>{task.column?.name ?? "Без статуса"} · {task.oilDepot?.name ?? "Без нефтебазы"} · {taskOwnerLabel(task)}</span>
      </div>
      <small>{item.reason}</small>
      <time>{task.deadline ? dateShort(task.deadline) : "без срока"}</time>
    </article>
  );
}

function TvTaskRow({ task }: { task: Task }) {
  const done = isCompletedColumn(task.column?.name ?? "");
  const progress = task.checklists?.length ? checklistProgress(task) : (done ? 100 : 0);
  const risk = taskRiskLabel(task);
  return (
    <article className={`tv-task-row tv-task-row-${String(task.priority).toLowerCase()}${done ? " tv-task-row-done" : ""}`}>
      <span className="tv-task-row-id">#{task.taskNumber}</span>
      <strong>{task.title}</strong>
      <span>{task.oilDepot?.name ?? "Без нефтебазы"}</span>
      <span>{taskOwnerLabel(task)}</span>
      <time>{task.deadline ? dateShort(task.deadline) : "-"}</time>
      <small>{risk}</small>
      <meter min={0} max={100} value={progress} />
    </article>
  );
}

function TvTaskCard({ task }: { task: Task }) {
  const done = isCompletedColumn(task.column?.name ?? "");
  const progress = task.checklists?.length ? checklistProgress(task) : (done ? 100 : 0);
  return (
    <article className={`tv-task tv-task-${String(task.priority).toLowerCase()}${done ? " tv-task-done" : ""}`}>
      <div className="tv-task-top">
        <span>#{task.taskNumber}</span>
        <b>{done ? "Закрыто" : priorityLabels[task.priority as keyof typeof priorityLabels]}</b>
      </div>
      <h2>{task.title}</h2>
      <div className="tv-task-meta">
        <span>{task.oilDepot?.name ?? "Без нефтебазы"}</span>
        {task.deadline ? <time>{dateShort(task.deadline)}</time> : null}
      </div>
      <div className="tv-task-bottom">
        <span>{taskAssignees(task).map((user: any) => user.name).join(", ") || "Не назначен"}</span>
        {task.checklists?.length ? <small>{checklistProgress(task)}%</small> : null}
      </div>
      <div className="tv-task-progress" aria-hidden="true"><span style={{ inlineSize: `${progress}%` }} /></div>
    </article>
  );
}

function buildFocusQueue(tasks: Task[]): TvFocusItem[] {
  return tasks
    .filter((task) => !isCompletedColumn(task.column?.name ?? ""))
    .map((task) => {
      const overdueDays = daysOverdue(task);
      const dueIn = daysUntilDeadline(task);
      const priority = priorityRank(task.priority);
      let score = priority * 10;
      let reason = priorityLabels[task.priority as keyof typeof priorityLabels] ?? task.priority;
      let tone: TvFocusItem["tone"] = priority >= 4 ? "amber" : "blue";

      if (overdueDays > 0) {
        score += 1000 + overdueDays * 12;
        reason = overdueDays === 1 ? "Просрочено на 1 день" : `Просрочено на ${overdueDays} дн.`;
        tone = "red";
      } else if (dueIn === 0) {
        score += 850;
        reason = "Срок сегодня";
        tone = "red";
      } else if (dueIn === 1) {
        score += 720;
        reason = "Срок завтра";
        tone = "amber";
      } else if (dueIn > 1 && dueIn <= 3) {
        score += 560 - dueIn * 20;
        reason = `Срок через ${dueIn} дн.`;
        tone = "amber";
      } else if (task.priority === "CRITICAL") {
        score += 430;
        reason = "Критический приоритет";
        tone = "red";
      } else if (task.priority === "HIGH") {
        score += 260;
        reason = "Высокий приоритет";
      }

      if (isReviewColumn(task.column?.name ?? "")) score -= 120;
      if (!task.deadline) score -= 60;

      return { task, reason, score, tone };
    })
    .filter((item) => item.score >= 40)
    .sort((a, b) => b.score - a.score || deadlineTime(a.task) - deadlineTime(b.task) || a.task.taskNumber - b.task.taskNumber);
}

function buildRecentActionFocus(tasks: Task[], activityLogs: any[]): TvRecentFocus[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set<string>();
  const fromLogs = activityLogs
    .filter((log) => log.taskId && tasksById.has(log.taskId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .flatMap((log) => {
      const task = tasksById.get(log.taskId);
      if (!task || seen.has(task.id)) return [];
      seen.add(task.id);
      return [{
        task,
        action: tvActivityLabel(log.action),
        actor: log.user?.name ?? "Система",
        updatedAt: log.createdAt,
        tone: recentFocusTone(task),
      }];
    });

  if (fromLogs.length) return fromLogs;

  return [...tasks]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((task) => ({
      task,
      action: "Обновлена",
      actor: task.author?.name ?? "Система",
      updatedAt: task.updatedAt,
      tone: recentFocusTone(task),
    }));
}

function buildTvActivityChart(tasks: Task[], activityLogs: any[]): TvChartPoint[] {
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = startOfToday();
    day.setDate(day.getDate() - (6 - index));
    return day;
  });

  return days.map((day) => ({
    label: new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(day).replace(".", ""),
    created: tasks.filter((task) => isSameCalendarDay(task.createdAt, day)).length,
    updated: activityLogs.length
      ? activityLogs.filter((log) => isSameCalendarDay(log.createdAt, day)).length
      : tasks.filter((task) => isSameCalendarDay(task.updatedAt, day)).length,
    completed: tasks.filter((task) => isCompletedColumn(task.column?.name ?? "") && isSameCalendarDay(task.updatedAt, day)).length,
  }));
}

function buildStatusRows(tasks: Task[]): TvStatusRow[] {
  const total = Math.max(1, tasks.length);
  const rows = [...tasks.reduce((map, task) => {
    const name = task.column?.name ?? "Без статуса";
    map.set(name, (map.get(name) ?? 0) + 1);
    return map;
  }, new Map<string, number>())];

  return rows.map(([name, count], index) => ({
    name,
    count,
    color: tvChartColors[index % tvChartColors.length],
    percent: Math.max(0, (count / total) * 100),
  }));
}

function buildDepotRows(tasks: Task[]) {
  const rows = [...tasks.reduce((map, task) => {
    const name = task.oilDepot?.name ?? "Без нефтебазы";
    map.set(name, (map.get(name) ?? 0) + 1);
    return map;
  }, new Map<string, number>())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"));
  const max = Math.max(1, ...rows.map(([, count]) => count));
  return rows.map(([name, count]) => ({ name, count, percent: Math.round((count / max) * 100) }));
}

function buildTvChartTicks(max: number) {
  const step = Math.max(1, Math.ceil(max / 3));
  const ceiling = step * 3;
  return Array.from({ length: 4 }, (_, index) => {
    const value = ceiling - step * index;
    return { value, y: scaleTvChartY(value, ceiling) };
  });
}

function chartCoordinates(values: number[], max: number): TvChartCoordinate[] {
  return values.map((value, index) => ({
    x: round(values.length === 1 ? 50 : (index / (values.length - 1)) * 100),
    y: scaleTvChartY(value, max),
  }));
}

function scaleTvChartY(value: number, max: number) {
  return round(tvChartBottom - (Math.max(0, value) / max) * (tvChartBottom - tvChartTop));
}

function pointsToAreaPath(points: TvChartCoordinate[]) {
  if (!points.length) return "";
  return `${pointsToMonotonePath(points)} L ${points[points.length - 1].x} ${tvChartBottom} L ${points[0].x} ${tvChartBottom} Z`;
}

function pointsToMonotonePath(points: TvChartCoordinate[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const widths = points.slice(1).map((point, index) => point.x - points[index].x);
  const slopes = points.slice(1).map((point, index) => (point.y - points[index].y) / widths[index]);
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes[slopes.length - 1];

    const previous = slopes[index - 1];
    const next = slopes[index];
    if (previous === 0 || next === 0 || previous * next < 0) return 0;

    const previousWidth = widths[index - 1];
    const nextWidth = widths[index];
    const firstWeight = 2 * nextWidth + previousWidth;
    const secondWeight = nextWidth + 2 * previousWidth;
    return (firstWeight + secondWeight) / (firstWeight / previous + secondWeight / next);
  });

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const width = widths[index];
    const segmentMin = Math.min(previous.y, point.y);
    const segmentMax = Math.max(previous.y, point.y);
    const controlStartY = clamp(previous.y + (tangents[index] * width) / 3, segmentMin, segmentMax);
    const controlEndY = clamp(point.y - (tangents[index + 1] * width) / 3, segmentMin, segmentMax);

    return `${path} C ${round(previous.x + width / 3)} ${round(controlStartY)}, ${round(point.x - width / 3)} ${round(controlEndY)}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function recentFocusTone(task: Task): TvRecentFocus["tone"] {
  if (isCompletedColumn(task.column?.name ?? "")) return "green";
  if (isOverdue(task) || task.priority === "CRITICAL") return "red";
  if (task.priority === "HIGH" || isDueSoon(task)) return "amber";
  return "blue";
}

function tvActivityLabel(action: string) {
  const labels: Record<string, string> = {
    TASK_CREATED: "Создана",
    TASK_UPDATED: "Обновлена",
    TASK_DELETED: "Удалена",
    STATUS_CHANGED: "Статус изменён",
    COMMENT_ADDED: "Комментарий",
    FILE_UPLOADED: "Файл добавлен",
    CHECKLIST_CHANGED: "Чек-лист",
    COLUMN_CHANGED: "Колонка",
  };
  return labels[action] ?? "Действие";
}

function isSameCalendarDay(value: string | Date | null | undefined, day: string | Date) {
  if (!value) return false;
  const left = new Date(value);
  const right = new Date(day);
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function relativeTimeLabel(value: string | Date) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return "сейчас";
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн`;
  return dateShort(new Date(value).toISOString());
}

function taskRiskLabel(task: Task) {
  const overdueDays = daysOverdue(task);
  if (overdueDays > 0) return overdueDays === 1 ? "overdue 1d" : `overdue ${overdueDays}d`;
  const dueIn = daysUntilDeadline(task);
  if (dueIn === 0) return "today";
  if (dueIn === 1) return "tomorrow";
  if (dueIn > 1 && dueIn <= 3) return `${dueIn}d`;
  if (task.priority === "CRITICAL") return "critical";
  if (task.priority === "HIGH") return "high";
  return priorityLabels[task.priority as keyof typeof priorityLabels] ?? task.priority;
}

function taskOwnerLabel(task: Task) {
  const assignees = taskAssignees(task).map((user: any) => user.name);
  if (!assignees.length) return "Не назначен";
  if (assignees.length === 1) return assignees[0];
  return `${assignees[0]} +${assignees.length - 1}`;
}

function TvTaskSpotlightOverlay({ spotlight }: { spotlight: TvTaskSpotlight }) {
  const task = spotlight.task;
  const done = isCompletedColumn(task.column?.name ?? "");
  const assignees = taskAssignees(task).map((user: any) => user.name).join(", ") || "Не назначен";
  const checklist = task.checklists?.length ? `${checklistProgress(task)}% чек-листа` : "Чек-лист не задан";
  const filesCount = task.fileAttachments?.length ?? 0;
  const commentsCount = task.comments?.length ?? 0;

  return (
    <aside className="tv-task-spotlight" aria-live="polite" aria-label="Обновление задачи">
      <article className={`tv-task-spotlight-card tv-task-spotlight-${spotlight.kind}`}>
        <div className="tv-task-spotlight-status">
          <span>{spotlight.kind === "created" ? "Новая задача" : "Задача обновлена"}</span>
          <strong>#{task.taskNumber}</strong>
        </div>
        <div className="tv-task-spotlight-main">
          <span className="tv-task-spotlight-kicker">{task.column?.name ?? "Без статуса"} · {done ? "Закрыто" : priorityLabels[task.priority as keyof typeof priorityLabels]}</span>
          <h2>{task.title}</h2>
          {task.description ? <p>{summarizeTaskText(task.description, 260)}</p> : null}
        </div>
        <dl className="tv-task-spotlight-facts">
          <div><dt>Исполнители</dt><dd>{assignees}</dd></div>
          <div><dt>Срок</dt><dd>{task.deadline ? dateShort(task.deadline) : "Не указан"}</dd></div>
          <div><dt>Нефтебаза</dt><dd>{task.oilDepot?.name ?? "Без нефтебазы"}</dd></div>
          <div><dt>Материалы</dt><dd>{commentsCount} комм. · {filesCount} файл. · {checklist}</dd></div>
        </dl>
        <div className="tv-task-spotlight-changes">
          {spotlight.changes.slice(0, 4).map((change) => <span key={change}>{change}</span>)}
        </div>
      </article>
    </aside>
  );
}

function taskAssignees(task: Task) {
  if (task.assignees?.length) return task.assignees.map((item: any) => item.user);
  return task.assignee ? [task.assignee] : [];
}

function buildTaskSnapshot(view: View) {
  const map = new Map<string, TvTaskSnapshot>();
  for (const column of view?.board?.columns ?? []) {
    for (const task of column.tasks ?? []) {
      const checklistItems = task.checklists?.flatMap((checklist: any) => checklist.items ?? []) ?? [];
      const checklistDone = checklistItems.filter((item: any) => item.completed).length;
      const assigneeNames = taskAssignees(task).map((user: any) => user.name).sort().join(", ");
      const snapshot: TvTaskSnapshot = {
        signature: "",
        title: task.title ?? "",
        columnId: task.columnId ?? column.id ?? "",
        columnName: task.column?.name ?? column.name ?? "",
        priority: task.priority ?? "",
        deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 10) : "",
        assigneeNames,
        commentsCount: task.comments?.length ?? 0,
        filesCount: task.fileAttachments?.length ?? 0,
        checklistDone,
        checklistTotal: checklistItems.length,
      };
      snapshot.signature = [
        snapshot.title,
        snapshot.columnId,
        snapshot.priority,
        snapshot.deadline,
        snapshot.assigneeNames,
        snapshot.commentsCount,
        snapshot.filesCount,
        snapshot.checklistDone,
        snapshot.checklistTotal,
        task.updatedAt ?? "",
      ].join("|");
      map.set(task.id, snapshot);
    }
  }
  return map;
}

function findTaskById(view: View, taskId: string) {
  for (const column of view?.board?.columns ?? []) {
    const task = column.tasks?.find((candidate: Task) => candidate.id === taskId);
    if (task) return task;
  }
  return null;
}

function describeTaskSnapshotChanges(previous: TvTaskSnapshot, next: TvTaskSnapshot) {
  const changes: string[] = [];
  if (previous.title !== next.title) changes.push("Изменено название");
  if (previous.columnId !== next.columnId) changes.push(`Статус: ${previous.columnName} → ${next.columnName}`);
  if (previous.priority !== next.priority) changes.push(`Приоритет: ${priorityLabels[next.priority as keyof typeof priorityLabels] ?? next.priority}`);
  if (previous.deadline !== next.deadline) changes.push(`Срок: ${next.deadline ? dateShort(`${next.deadline}T00:00:00.000Z`) : "не указан"}`);
  if (previous.assigneeNames !== next.assigneeNames) changes.push(`Исполнители: ${next.assigneeNames || "не назначены"}`);
  if (previous.commentsCount !== next.commentsCount) changes.push(next.commentsCount > previous.commentsCount ? "Добавлен комментарий" : "Комментарии обновлены");
  if (previous.filesCount !== next.filesCount) changes.push(next.filesCount > previous.filesCount ? "Добавлен файл" : "Файлы обновлены");
  if (previous.checklistDone !== next.checklistDone || previous.checklistTotal !== next.checklistTotal) changes.push(`Чек-лист: ${next.checklistDone}/${next.checklistTotal}`);
  return changes.length ? changes : ["Обновлены данные задачи"];
}

function summarizeTaskText(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

function nextTvMode(current: TvMode, direction: 1 | -1) {
  const index = tvModes.findIndex((mode) => mode.id === current);
  const nextIndex = (index + direction + tvModes.length) % tvModes.length;
  return tvModes[nextIndex].id;
}

function tvModeIcon(mode: TvMode) {
  if (mode === "standby") return Clock3;
  if (mode === "news") return Newspaper;
  if (mode === "tasks") return ListChecks;
  if (mode === "jokes") return Smile;
  return Target;
}

function priorityRank(priority: string) {
  if (priority === "CRITICAL") return 5;
  if (priority === "HIGH") return 4;
  if (priority === "MEDIUM") return 3;
  if (priority === "PLANNED") return 2;
  return 1;
}

function deadlineTime(task: Task) {
  return task.deadline ? new Date(task.deadline).getTime() : Number.MAX_SAFE_INTEGER;
}

function cleanNewsText(value: string) {
  const withoutBlocks = value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ");

  return decodeHtmlEntities(withoutBlocks)
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b(?:www\.)?dzen\.ru\/\S+/gi, "")
    .replace(/\b(?:class|style|data-[\w-]+|aria-[\w-]+|href|src|target|rel)\s*=\s*["'][^"']*["']/gi, " ")
    .replace(/\b(?:div|span|script|style|class|href|src)\b/gi, " ")
    .replace(/[<>]+/g, " ")
    .replace(/\b(?:читать далее|подробнее|источник)\b[:\s]*/gi, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function prependNewsHistory(item: TvNews, items: TvNews[]) {
  return [item, ...items.filter((entry) => entry.id !== item.id)].slice(0, 6);
}

function prependJokeHistory(item: TvJoke, items: TvJoke[]) {
  return [item, ...items.filter((entry) => entry.text !== item.text)].slice(0, 6);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function buildSummary(tasks: Task[], view: View) {
  const completedColumnIds = new Set((view?.board?.columns ?? []).filter((column: any) => isCompletedColumn(column.name)).map((column: any) => column.id));
  return {
    active: tasks.filter((task) => !completedColumnIds.has(task.columnId)).length,
    inProgress: tasks.filter((task) => isWorkColumn(task.column?.name ?? "")).length,
    overdue: tasks.filter((task) => isOverdue(task)).length,
    critical: tasks.filter((task) => task.priority === "CRITICAL").length,
    completed: tasks.filter((task) => completedColumnIds.has(task.columnId)).length,
  };
}



function isOverdue(task: Task) {
  return Boolean(task.deadline && new Date(task.deadline).getTime() < startOfToday().getTime() && !isCompletedColumn(task.column?.name ?? "") && !isReviewColumn(task.column?.name ?? ""));
}

function isDueSoon(task: Task) {
  if (!task.deadline || isOverdue(task) || isCompletedColumn(task.column?.name ?? "")) return false;
  const dueIn = daysUntilDeadline(task);
  return dueIn >= 0 && dueIn <= 3;
}

function daysOverdue(task: Task) {
  if (!task.deadline || isCompletedColumn(task.column?.name ?? "") || isReviewColumn(task.column?.name ?? "")) return 0;
  const diff = startOfToday().getTime() - deadlineDay(task).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

function daysUntilDeadline(task: Task) {
  if (!task.deadline) return Number.MAX_SAFE_INTEGER;
  const diff = deadlineDay(task).getTime() - startOfToday().getTime();
  return Math.floor(diff / 86_400_000);
}

function deadlineDay(task: Task) {
  const value = new Date(task.deadline);
  value.setHours(0, 0, 0, 0);
  return value;
}

function isCompletedColumn(name: string) {
  const normalized = name.toLowerCase();
  return normalized.includes("готов") || normalized.includes("done") || normalized.includes("complete") || normalized.includes("РіРѕС‚РѕРІ".toLowerCase());
}

function isReviewColumn(name: string) {
  const normalized = name.toLowerCase();
  return normalized.includes("провер") || normalized.includes("review") || normalized.includes("verify") || normalized.includes("approval") || normalized.includes("РїСЂРѕРІРµСЂ".toLowerCase());
}

function isWorkColumn(name: string) {
  const normalized = name.toLowerCase();
  return normalized.includes("работ") || normalized.includes("progress") || normalized.includes("doing");
}

function checklistProgress(task: Task) {
  const items = task.checklists.flatMap((checklist: any) => checklist.items);
  if (!items.length) return 0;
  return Math.round((items.filter((item: any) => item.completed).length / items.length) * 100);
}



function timeOnly(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(value);
}

function cityTime(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone }).format(value);
}

function hourOnly(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function dateLong(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long" }).format(value);
}

function dateShort(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function nextNewsRefreshLabel(nextRefreshAt: string, now: Date, stale: boolean) {
  const remainingMs = Math.max(0, new Date(nextRefreshAt).getTime() - now.getTime());
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return stale ? `Ожидаем новую · проверка через ${minutes} мин` : `Следующая через ${minutes} мин`;
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}


async function fetchOfficeWeatherDirect() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(officeWeatherLocation.latitude));
  url.searchParams.set("longitude", String(officeWeatherLocation.longitude));
  url.searchParams.set("timezone", "Europe/Moscow");
  url.searchParams.set("forecast_hours", "24");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("current", "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m");
  url.searchParams.set("hourly", "precipitation_probability,precipitation,weather_code,temperature_2m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max");

  const response = await fetch(url);
  if (!response.ok) throw new Error("Direct weather request failed");
  const data = await response.json();
  const precipitationProbability = data.hourly?.precipitation_probability ?? [];
  const precipitation = data.hourly?.precipitation ?? [];
  const nextPrecipitationIndex = precipitationProbability.findIndex((value: number, index: number) => value >= 45 || Number(precipitation[index] ?? 0) > 0);
  const tomorrowWeatherCode = Number(data.daily?.weather_code?.[1] ?? data.current?.weather_code ?? 0);

  return {
    office: officeWeatherLocation,
    updatedAt: new Date().toISOString(),
    temperature: Math.round(Number(data.current?.temperature_2m ?? 0)),
    apparentTemperature: Math.round(Number(data.current?.apparent_temperature ?? 0)),
    precipitation: Number(data.current?.precipitation ?? 0),
    windSpeed: Math.round(Number(data.current?.wind_speed_10m ?? 0)),
    windGusts: Math.round(Number(data.current?.wind_gusts_10m ?? 0)),
    weatherCode: Number(data.current?.weather_code ?? 0),
    summary: weatherLabels[Number(data.current?.weather_code ?? 0)] ?? "Погода",
    hourlyForecast: buildWeatherHourlyForecast(data),
    tomorrow: data.daily?.time?.[1]
      ? {
          date: data.daily.time[1],
          temperatureMin: Math.round(Number(data.daily.temperature_2m_min?.[1] ?? 0)),
          temperatureMax: Math.round(Number(data.daily.temperature_2m_max?.[1] ?? 0)),
          precipitation: Number(data.daily.precipitation_sum?.[1] ?? 0),
          probability: Number(data.daily.precipitation_probability_max?.[1] ?? 0),
          summary: weatherLabels[tomorrowWeatherCode] ?? "Прогноз",
        }
      : null,
    nextPrecipitation:
      nextPrecipitationIndex >= 0
        ? {
            time: data.hourly.time[nextPrecipitationIndex],
            probability: precipitationProbability[nextPrecipitationIndex],
            precipitation: precipitation[nextPrecipitationIndex],
            summary: weatherLabels[Number(data.hourly.weather_code[nextPrecipitationIndex] ?? 0)] ?? "Осадки",
          }
        : null,
  };
}

function buildWeatherHourlyForecast(data: any) {
  const times = data.hourly?.time ?? [];
  const firstFutureIndex = times.findIndex((time: string) => new Date(time).getTime() >= Date.now());
  const start = firstFutureIndex >= 0 ? firstFutureIndex : 0;

  return times.slice(start, start + 4).map((time: string, offset: number) => {
    const index = start + offset;
    const weatherCode = Number(data.hourly?.weather_code?.[index] ?? data.current?.weather_code ?? 0);
    return {
      time,
      temperature: Math.round(Number(data.hourly?.temperature_2m?.[index] ?? 0)),
      probability: Number(data.hourly?.precipitation_probability?.[index] ?? 0),
      precipitation: Number(data.hourly?.precipitation?.[index] ?? 0),
      summary: weatherLabels[weatherCode] ?? "Погода",
    };
  });
}

