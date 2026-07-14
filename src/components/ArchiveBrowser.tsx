"use client";

import { Calendar, CheckSquare, Eye, FileText, Paperclip, UsersRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ArchiveTask = {
  id: string;
  taskNumber: number;
  title: string;
  description: string;
  priority: "LOW" | "PLANNED" | "MEDIUM" | "HIGH" | "CRITICAL";
  deadline: string | null;
  archivedAt: string | null;
  column: { name: string };
  oilDepot: { name: string } | null;
  assignee: { id: string; name: string; email: string } | null;
  assignees: Array<{ user: { id: string; name: string; email: string } }>;
  archivedBy: { id: string; name: string; email: string } | null;
  author: { id: string; name: string; email: string };
  checklists: Array<{ id: string; title: string; items: Array<{ id: string; text: string; completed: boolean }> }>;
  comments: Array<{ id: string; text: string; createdAt: string; author: { name: string } }>;
  fileAttachments: Array<{ id: string; fileName: string; url: string; size: number; uploader: { name: string } }>;
};

const priorityLabels = { LOW: "Низкий", PLANNED: "Плановые работы", MEDIUM: "Средний", HIGH: "Высокий", CRITICAL: "Критический" } as const;

export function ArchiveBrowser({ tasks }: { tasks: ArchiveTask[] }) {
  const [selected, setSelected] = useState<ArchiveTask | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selected && dialog && !dialog.open) dialog.showModal();
  }, [selected]);

  function close() {
    dialogRef.current?.close();
  }

  return (
    <section className="history-panel history-page-panel">
      <div className="history-table archive-table">
        <div className="history-row history-row-head">
          <span>Номер</span>
          <span>Задача</span>
          <span>Статус</span>
          <span>Нефтебаза</span>
          <span>Архивировал</span>
          <span>Дата</span>
          <span aria-hidden="true" />
        </div>
        {tasks.length ? tasks.map((task) => (
          <button className="history-row archive-row archive-row-button" type="button" key={task.id} onClick={() => setSelected(task)}>
            <span data-label="Номер">#{task.taskNumber}</span>
            <span className="history-task" data-label="Задача">{task.title}</span>
            <span data-label="Статус">{task.column.name}</span>
            <span data-label="Нефтебаза">{task.oilDepot?.name ?? "Без нефтебазы"}</span>
            <span data-label="Архивировал">{task.archivedBy?.name ?? "Система"}</span>
            <span className="history-meta" data-label="Дата">{task.archivedAt ? formatDateTime(task.archivedAt) : ""}</span>
            <span className="archive-open-action"><Eye size={16} aria-hidden="true" />Открыть</span>
          </button>
        )) : <p className="muted history-empty">Архив пока пустой.</p>}
      </div>

      <dialog ref={dialogRef} className="archive-task-dialog" aria-labelledby="archive-task-title" onClose={() => setSelected(null)} onClick={(event) => event.target === event.currentTarget && close()}>
        {selected ? (
          <article className="archive-task-view">
            <header>
              <div>
                <span className="modal-kicker">Архивная задача #{selected.taskNumber}</span>
                <h2 id="archive-task-title">{selected.title}</h2>
              </div>
              <button className="button icon secondary" type="button" aria-label="Закрыть заявку" onClick={close}><X size={18} /></button>
            </header>

            <div className="archive-task-facts">
              <span><CheckSquare size={16} aria-hidden="true" /><b>Статус</b>{selected.column.name}</span>
              <span><FileText size={16} aria-hidden="true" /><b>Приоритет</b>{priorityLabels[selected.priority]}</span>
              <span><Calendar size={16} aria-hidden="true" /><b>Срок</b>{selected.deadline ? formatDate(selected.deadline) : "Не указан"}</span>
              <span><UsersRound size={16} aria-hidden="true" /><b>Исполнители</b>{assigneeNames(selected)}</span>
            </div>

            <section className="archive-task-section">
              <h3>Описание</h3>
              <p>{selected.description || "Описание не добавлено."}</p>
            </section>

            <div className="archive-task-columns">
              <section className="archive-task-section">
                <h3>Чек-лист</h3>
                {selected.checklists.flatMap((checklist) => checklist.items).length ? (
                  <ul className="archive-checklist">
                    {selected.checklists.flatMap((checklist) => checklist.items).map((item) => <li className={item.completed ? "is-complete" : ""} key={item.id}><CheckSquare size={15} aria-hidden="true" />{item.text}</li>)}
                  </ul>
                ) : <p className="muted">Пунктов нет.</p>}
              </section>

              <section className="archive-task-section">
                <h3>Файлы</h3>
                {selected.fileAttachments.length ? selected.fileAttachments.map((file) => (
                  <a className="archive-file" href={file.url} target="_blank" rel="noreferrer" key={file.id}><Paperclip size={15} aria-hidden="true" /><span><strong>{file.fileName}</strong><small>{file.uploader.name}</small></span></a>
                )) : <p className="muted">Файлов нет.</p>}
              </section>
            </div>

            <section className="archive-task-section">
              <h3>Комментарии</h3>
              {selected.comments.length ? selected.comments.map((comment) => <blockquote key={comment.id}><p>{comment.text}</p><footer>{comment.author.name} · {formatDateTime(comment.createdAt)}</footer></blockquote>) : <p className="muted">Комментариев нет.</p>}
            </section>
          </article>
        ) : null}
      </dialog>
    </section>
  );
}

function assigneeNames(task: ArchiveTask) {
  if (task.assignees.length) return task.assignees.map((item) => item.user.name).join(", ");
  return task.assignee?.name ?? "Не назначены";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
