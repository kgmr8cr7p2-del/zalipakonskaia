"use client";

import { CalendarClock, Clock3, CloudSun, ListChecks, Minimize2, Newspaper, Radio, Smile, Target, Wind } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

const FEATURE_HOLD_MS = 2 * 60 * 1000;
const MANUAL_HOLD_MS = 2 * 60 * 1000;
const AUTO_ROTATION_MS = 3 * 60 * 1000;
const TASK_SPOTLIGHT_MS = 9000;

export function BoardTvClient({ initialView, initialNews = null }: { initialView: View; initialNews?: TvNews | null }) {
  const [view, setView] = useState(initialView);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [now, setNow] = useState(new Date());
  const [joke, setJoke] = useState<TvJoke>({ text: officeJokes[0], sourceUrl: null, updatedAt: "fallback" });
  const [news, setNews] = useState<TvNews | null>(initialNews);
  const [tvMode, setTvMode] = useState<TvMode>("standby");
  const [manualModeUntil, setManualModeUntil] = useState(0);
  const [newsUnavailable, setNewsUnavailable] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date());
  const [connectionState, setConnectionState] = useState<"live" | "stale">("live");
  const [taskSpotlight, setTaskSpotlight] = useState<TvTaskSpotlight | null>(null);
  const seenNewsIdRef = useRef<string | null>(initialNews?.id ?? null);
  const seenJokeUpdateRef = useRef<string | null>(null);
  const taskSnapshotRef = useRef(buildTaskSnapshot(initialView));
  const featureReturnTimerRef = useRef<number | null>(null);
  const taskSpotlightTimerRef = useRef<number | null>(null);

  const tasks = useMemo(() => view?.board?.columns?.flatMap((column: any) => column.tasks) ?? [], [view]);
  const summary = useMemo(() => buildSummary(tasks, view), [tasks, view]);
  const cleanNews = useMemo(() => news ? { ...news, summary: cleanNewsText(news.summary) } : null, [news]);
  const activeModeIndex = tvModes.findIndex((mode) => mode.id === tvMode);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
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
    if (!seenNewsIdRef.current) {
      seenNewsIdRef.current = news.id;
      return;
    }
    if (seenNewsIdRef.current === news.id) return;

    seenNewsIdRef.current = news.id;
    showTemporaryMode("news");
  }, [news?.id]);

  useEffect(() => {
    if (!joke.updatedAt || joke.updatedAt === "fallback") return;
    if (!seenJokeUpdateRef.current) {
      seenJokeUpdateRef.current = joke.updatedAt;
      return;
    }
    if (seenJokeUpdateRef.current === joke.updatedAt) return;

    seenJokeUpdateRef.current = joke.updatedAt;
    showTemporaryMode("jokes");
  }, [joke.updatedAt]);

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
        {tvMode === "standby" ? <TvStandby now={now} weather={weather} news={cleanNews} newsUnavailable={newsUnavailable} joke={joke} summary={summary} tasks={tasks} /> : null}
        {tvMode === "news" ? <TvNewsReader news={cleanNews} unavailable={newsUnavailable} now={now} /> : null}
        {tvMode === "tasks" ? <section className="tv-board" aria-label="Канбан-доска для телевизора">
          {view?.board?.columns?.map((column: any) => (
            <article className={`tv-column${isCompletedColumn(column.name) ? " tv-column-done" : ""}`} key={column.id}>
              <header>
                <span>{column.name}</span>
                <b>{column.tasks.length}</b>
              </header>
              <div className="tv-task-list">
                {column.tasks.slice(0, 5).map((task: Task) => (
                  <TvTaskCard key={task.id} task={task} />
                ))}
                {column.tasks.length > 5 ? <div className="tv-more-card">+{column.tasks.length - 5} еще</div> : null}
                {!column.tasks.length ? <div className="tv-empty-column">Нет задач</div> : null}
              </div>
            </article>
          ))}
        </section> : null}
        {tvMode === "jokes" ? <TvJokeStage joke={joke} now={now} weather={weather} /> : null}
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

function TvStandby({ now, weather, news, newsUnavailable, joke, summary, tasks }: { now: Date; weather: Weather | null; news: TvNews | null; newsUnavailable: boolean; joke: TvJoke; summary: ReturnType<typeof buildSummary>; tasks: Task[] }) {
  const nextDeadline = [...tasks]
    .filter((task) => task.deadline && !isCompletedColumn(task.column?.name ?? ""))
    .sort((a, b) => deadlineTime(a) - deadlineTime(b))[0];

  return (
    <section className="tv-standby" aria-label="Standby режим">
      <article className="tv-standby-clock">
        <span>{dateLong(now)}</span>
        <strong>{timeOnly(now)}</strong>
      </article>
      <article className="tv-standby-side">
        <WeatherPanel weather={weather} />
        <div className="tv-standby-stats">
          <span><b>{summary.active}</b> активно</span>
          <span><b>{summary.overdue}</b> просрочено</span>
          <span><b>{summary.critical}</b> критично</span>
        </div>
      </article>
      <article className="tv-standby-news">
        <span><Newspaper size={17} /> Новости</span>
        <strong>{news?.title ?? (newsUnavailable ? "Новости временно недоступны" : "Загружаем главную новость")}</strong>
        {news?.summary ? <p>{news.summary}</p> : null}
      </article>
      <article className="tv-standby-footer-card">
        <span><CalendarClock size={17} /> Ближайший срок</span>
        <strong>{nextDeadline ? `#${nextDeadline.taskNumber} ${nextDeadline.title}` : "На горизонте спокойно"}</strong>
        <small>{nextDeadline?.deadline ? `${dateShort(nextDeadline.deadline)} · ${nextDeadline.oilDepot?.name ?? "Без нефтебазы"}` : "Нет ближайших дедлайнов"}</small>
      </article>
      <article className="tv-standby-footer-card">
        <span><Smile size={17} /> Пауза</span>
        <strong>{joke.text}</strong>
      </article>
    </section>
  );
}

function TvNewsReader({ news, unavailable, now }: { news: TvNews | null; unavailable: boolean; now: Date }) {
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
    </section>
  );
}

function TvJokeStage({ joke, now, weather }: { joke: TvJoke; now: Date; weather: Weather | null }) {
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
    </section>
  );
}

function TvFocusDashboard({ tasks, summary }: { tasks: Task[]; summary: ReturnType<typeof buildSummary> }) {
  const focusTasks = [...tasks]
    .filter((task) => task.priority === "CRITICAL" || isOverdue(task) || isDueSoon(task))
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || deadlineTime(a) - deadlineTime(b))
    .slice(0, 8);

  return (
    <section className="tv-focus-dashboard" aria-label="Фокус дня">
      <article className="tv-dashboard-hero tv-dashboard-critical">
        <Target size={30} />
        <div>
          <strong>Фокус дня</strong>
          <span>{summary.overdue} просрочено · {summary.critical} критично · {summary.inProgress} в работе</span>
        </div>
      </article>
      <div className="tv-focus-list-large">
        {focusTasks.length ? focusTasks.map((task) => <TvTaskCard key={task.id} task={task} />) : <div className="tv-empty-column">Критичных задач нет</div>}
      </div>
    </section>
  );
}

function TvTaskCard({ task }: { task: Task }) {
  const done = isCompletedColumn(task.column?.name ?? "");
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
    </article>
  );
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
  if (!task.deadline || isOverdue(task)) return false;
  const diff = new Date(task.deadline).getTime() - Date.now();
  return diff <= 3 * 24 * 60 * 60 * 1000;
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
  url.searchParams.set("forecast_hours", "12");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("current", "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m");
  url.searchParams.set("hourly", "precipitation_probability,precipitation,weather_code,temperature_2m");

  const response = await fetch(url);
  if (!response.ok) throw new Error("Direct weather request failed");
  const data = await response.json();
  const precipitationProbability = data.hourly?.precipitation_probability ?? [];
  const precipitation = data.hourly?.precipitation ?? [];
  const nextPrecipitationIndex = precipitationProbability.findIndex((value: number, index: number) => value >= 45 || Number(precipitation[index] ?? 0) > 0);

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

