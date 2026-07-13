"use client";

import { CalendarDays, CheckSquare, ChevronLeft, ChevronRight, MessageSquare, Paperclip } from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/ProfileCard/ProfileCard";

type TaskTimelineProps = {
  tasks: any[];
  onOpen: (task: any) => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function TaskTimeline({ tasks, onOpen }: TaskTimelineProps) {
  const [daysCount, setDaysCount] = useState(30);
  const [offset, setOffset] = useState(0);
  const rangeStart = useMemo(() => addDays(startOfDay(new Date()), -5 + offset), [offset]);
  const days = useMemo(() => Array.from({ length: daysCount }, (_, index) => addDays(rangeStart, index)), [daysCount, rangeStart]);
  const rangeEnd = addDays(rangeStart, daysCount);

  const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(rangeStart);

  return (
    <section className="task-timeline" aria-label="Таймлайн задач">
      <header className="task-timeline-toolbar">
        <div className="task-timeline-heading">
          <span className="task-timeline-icon"><CalendarDays size={19} /></span>
          <div>
            <h2>Таймлайн</h2>
            <p>{monthLabel}</p>
          </div>
        </div>
        <div className="task-timeline-actions" aria-label="Управление периодом">
          <button className="button secondary icon" type="button" aria-label="Предыдущий период" onClick={() => setOffset((value) => value - Math.max(7, Math.floor(daysCount / 2)))}><ChevronLeft size={18} /></button>
          <button className="button secondary" type="button" onClick={() => setOffset(0)}>Сегодня</button>
          <button className="button secondary icon" type="button" aria-label="Следующий период" onClick={() => setOffset((value) => value + Math.max(7, Math.floor(daysCount / 2)))}><ChevronRight size={18} /></button>
          <select className="select task-timeline-range" aria-label="Масштаб таймлайна" value={daysCount} onChange={(event) => setDaysCount(Number(event.currentTarget.value))}>
            <option value={14}>14 дней</option>
            <option value={30}>30 дней</option>
            <option value={60}>60 дней</option>
          </select>
        </div>
      </header>

      <div className="task-timeline-scroll">
        <div className="task-timeline-table" style={{ "--timeline-days": daysCount } as CSSProperties}>
          <div className="task-timeline-dates" aria-hidden="true">
            <div className="task-timeline-label task-timeline-label-head">Задача</div>
            <div className="task-timeline-date-grid">
              {days.map((day) => {
                const isToday = sameDay(day, new Date());
                const isWeekend = [0, 6].includes(day.getDay());
                return (
                  <div className={`task-timeline-date ${isToday ? "is-today" : ""} ${isWeekend ? "is-weekend" : ""}`} key={day.toISOString()}>
                    <small>{new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(day)}</small>
                    <strong>{day.getDate()}</strong>
                  </div>
                );
              })}
            </div>
          </div>

          {tasks.length ? tasks.map((task) => {
            const schedule = taskSchedule(task);
            const start = Math.max(0, differenceInDays(schedule.start, rangeStart));
            const rawEnd = Math.max(start + 1, differenceInDays(schedule.end, rangeStart) + 1);
            const end = Math.min(daysCount, rawEnd);
            const isOutside = schedule.end < rangeStart || schedule.start >= rangeEnd;
            const assignees = taskAssignees(task);
            const checklistItems = (task.checklists ?? []).flatMap((checklist: any) => checklist.items ?? []);
            const completedItems = checklistItems.filter((item: any) => item.completed).length;

            return (
              <div className="task-timeline-row" key={task.id}>
                <button className="task-timeline-label" type="button" onClick={() => onOpen(task)}>
                  <span className={`task-timeline-priority priority-${task.priority}`} />
                  <span className="task-timeline-label-copy">
                    <strong>#{task.taskNumber} {task.title}</strong>
                    <small>{task.column?.name ?? "Без статуса"}</small>
                  </span>
                </button>
                <div className="task-timeline-canvas">
                  {days.map((day) => <span className={`task-timeline-cell ${sameDay(day, new Date()) ? "is-today" : ""} ${[0, 6].includes(day.getDay()) ? "is-weekend" : ""}`} key={day.toISOString()} />)}
                  {!isOutside ? (
                    <button
                      className={`task-timeline-bar priority-${task.priority}`}
                      type="button"
                      onClick={() => onOpen(task)}
                      style={{ left: `calc(${start} * var(--timeline-day-width) + 5px)`, width: `calc(${Math.max(1, end - start)} * var(--timeline-day-width) - 10px)` }}
                    >
                      <span className="task-timeline-bar-title">{task.title}</span>
                      <span className="task-timeline-stats">
                        {(task.comments?.length ?? 0) > 0 ? <span><MessageSquare size={12} />{task.comments.length}</span> : null}
                        {checklistItems.length > 0 ? <span><CheckSquare size={12} />{completedItems}/{checklistItems.length}</span> : null}
                        {(task.fileAttachments?.length ?? 0) > 0 ? <span><Paperclip size={12} />{task.fileAttachments.length}</span> : null}
                      </span>
                      {assignees.length ? <span className="task-timeline-avatars" aria-label={`Исполнители: ${assignees.map((user: any) => user.name).join(", ")}`}>
                        {assignees.slice(0, 3).map((user: any) => <ProfileAvatar key={user.id} name={user.name} avatarUrl={user.avatarUrl} size={22} />)}
                        {assignees.length > 3 ? <span className="task-timeline-avatar-more">+{assignees.length - 3}</span> : null}
                      </span> : null}
                    </button>
                  ) : <span className="task-timeline-outside">Вне выбранного периода</span>}
                </div>
              </div>
            );
          }) : <div className="task-timeline-empty">На этой доске пока нет задач.</div>}
        </div>
      </div>
    </section>
  );
}

function taskSchedule(task: any) {
  const createdAt = startOfDay(task.createdAt ? new Date(task.createdAt) : new Date());
  if (!task.deadline) return { start: createdAt, end: addDays(createdAt, 2) };
  const end = startOfDay(new Date(task.deadline));
  const proposedStart = addDays(end, -4);
  return { start: createdAt > proposedStart ? createdAt : proposedStart, end: end < createdAt ? createdAt : end };
}

function taskAssignees(task: any) {
  if (task.assignees?.length) return task.assignees.map((entry: any) => entry.user).filter(Boolean);
  return task.assignee ? [task.assignee] : [];
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * DAY_MS);
}

function differenceInDays(a: Date, b: Date) {
  return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);
}

function sameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}
