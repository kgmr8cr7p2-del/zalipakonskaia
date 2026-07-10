"use client";

import { CloudSun, Radio, Wind } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type View = any;
type Task = any;
type Weather = any;

const priorityLabels = {
  LOW: "Низкий",
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

export function BoardTvClient({ initialView }: { initialView: View }) {
  const [view, setView] = useState(initialView);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [now, setNow] = useState(new Date());
  const [joke, setJoke] = useState<TvJoke>({ text: officeJokes[0], sourceUrl: null, updatedAt: "fallback" });
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date());
  const [connectionState, setConnectionState] = useState<"live" | "stale">("live");

  const tasks = useMemo(() => view?.board?.columns?.flatMap((column: any) => column.tasks) ?? [], [view]);
  const summary = useMemo(() => buildSummary(tasks, view), [tasks, view]);

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
    const timer = window.setInterval(() => void refreshBoard(), 15 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function refreshBoard() {
    try {
      const response = await fetch("/api/board");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Board refresh failed");
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

  async function refreshJoke() {
    try {
      const response = await fetch(`/api/jokes/shortiki?at=${Date.now()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.joke) throw new Error(data.error ?? "Joke refresh failed");
      setJoke({ text: data.joke, sourceUrl: data.sourceUrl ?? "https://shortiki.com/", updatedAt: data.updatedAt ?? String(Date.now()) });
    } catch {
      setJoke((current) => {
        if (current.sourceUrl) return current;
        const currentIndex = Math.max(0, officeJokes.indexOf(current.text));
        return { text: officeJokes[(currentIndex + 1) % officeJokes.length], sourceUrl: null, updatedAt: String(Date.now()) };
      });
    }
  }

  return (
    <main className="tv-page">
      <header className="tv-hero">
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
          <span className="tv-joke-label">
            Анекдот · обновление через 5 минут
            {joke.sourceUrl ? <a href={joke.sourceUrl}>shortiki.com</a> : null}
          </span>
          <strong key={joke.updatedAt}>{joke.text}</strong>
        </section>
      </header>

      <section className="tv-layout">
        <section className="tv-board" aria-label="Канбан-доска для телевизора">
          {view?.board?.columns?.map((column: any) => (
            <article className="tv-column" key={column.id}>
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
        </section>
      </section>

      <footer className="tv-footer">
        <span>Обновлено {timeOnly(lastUpdatedAt)}</span>
        <span>{view?.board?.name ?? "Team Kanban Board"}</span>
      </footer>
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


function TvTaskCard({ task }: { task: Task }) {
  return (
    <article className={`tv-task tv-task-${String(task.priority).toLowerCase()}`}>
      <div className="tv-task-top">
        <span>#{task.taskNumber}</span>
        <b>{priorityLabels[task.priority as keyof typeof priorityLabels]}</b>
      </div>
      <h2>{task.title}</h2>
      <div className="tv-task-meta">
        <span>{task.oilDepot?.name ?? "Без нефтебазы"}</span>
        {task.deadline ? <time>{dateShort(task.deadline)}</time> : null}
      </div>
      <div className="tv-task-bottom">
        <span>{task.assignee?.name ?? "Не назначен"}</span>
        {task.checklists?.length ? <small>{checklistProgress(task)}%</small> : null}
      </div>
    </article>
  );
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

