"use client";

import { ArrowDown, ArrowUp, Check, Columns3, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type ColumnItem = { id: string; name: string; position: number; tasks: unknown[] };

export function BoardSettings({ columns, canManage }: { columns: ColumnItem[]; canManage: boolean }) {
  const [items, setItems] = useState(columns);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ColumnItem | null>(null);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) return;

    setError("");
    setIsAdding(true);
    try {
      const response = await fetch("/api/columns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Не удалось создать колонку");
      setItems((current) => [...current, { ...data.column, tasks: [] }]);
      form.reset();
    } finally {
      setIsAdding(false);
    }
  }

  async function rename(column: ColumnItem, name: string) {
    const nextName = name.trim();
    if (!nextName || nextName === column.name) return;

    setError("");
    setPendingId(column.id);
    const response = await fetch(`/api/columns/${column.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    });
    const data = await response.json();
    setPendingId(null);
    if (!response.ok) return setError(data.error ?? "Не удалось переименовать колонку");
    setItems((current) => current.map((item) => (item.id === column.id ? { ...item, name: nextName } : item)));
    showSaved(column.id);
  }

  async function remove(id: string) {
    setError("");
    setPendingId(id);
    const response = await fetch(`/api/columns/${id}`, { method: "DELETE" });
    const data = await response.json();
    setPendingId(null);
    if (!response.ok) return setError(data.error ?? "Не удалось удалить колонку");
    setItems((current) => current.filter((item) => item.id !== id));
  }

  async function reorder(nextItems: ColumnItem[], previousItems: ColumnItem[]) {
    setItems(nextItems);
    setPendingId("order");
    const response = await fetch("/api/columns/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderedIds: nextItems.map((item) => item.id) }),
    });
    const data = await response.json();
    setPendingId(null);
    if (!response.ok) {
      setItems(previousItems);
      setError(data.error ?? "Не удалось сохранить порядок колонок");
      return;
    }
    showSaved("order");
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const previous = [...items];
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    void reorder(next.map((item, position) => ({ ...item, position })), previous);
  }

  function showSaved(id: string) {
    setSavedId(id);
    window.setTimeout(() => setSavedId((current) => (current === id ? null : current)), 1_800);
  }

  if (!canManage) return <div className="empty">Настройки колонок доступны только администратору.</div>;

  return (
    <section className="settings-block settings-manager" aria-labelledby="board-columns-title">
      <header className="settings-manager-head">
        <span className="settings-manager-icon"><Columns3 size={20} /></span>
        <div>
          <h2 id="board-columns-title">Колонки доски</h2>
          <p>Настройте этапы работы и порядок слева направо.</p>
        </div>
        <span className="settings-summary-badge">{items.length} колонок</span>
      </header>

      <form className="settings-add-form" onSubmit={add}>
        <label className="field">
          <span>Новая колонка</span>
          <input className="input" name="name" placeholder="Например, На согласовании" required maxLength={80} />
        </label>
        <button className="button" disabled={isAdding}>
          <Plus size={18} />
          {isAdding ? "Добавляем…" : "Добавить колонку"}
        </button>
      </form>

      {error ? <p className="settings-error" role="alert">{error}</p> : null}
      <div className="settings-list" aria-label="Колонки доски">
        {items.map((column, index) => {
          const taskCount = column.tasks.length;
          const isBusy = pendingId === column.id || pendingId === "order";
          return (
            <article className="settings-row settings-column-row" key={column.id}>
              <span className="settings-position" aria-label={`Позиция ${index + 1}`}>{index + 1}</span>
              <label className="settings-name-field">
                <span className="visually-hidden">Название колонки</span>
                <input
                  className="input"
                  defaultValue={column.name}
                  disabled={isBusy}
                  onBlur={(event) => void rename(column, event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                />
              </label>
              <span className="settings-item-meta">
                <strong>{taskCount}</strong>
                {taskCount === 1 ? "задача" : "задач"}
              </span>
              <span className="settings-save-state" aria-live="polite">
                {isBusy ? "Сохраняем…" : savedId === column.id || savedId === "order" ? <><Check size={14} /> Сохранено</> : ""}
              </span>
              <div className="settings-row-actions" aria-label={`Действия с колонкой ${column.name}`}>
                <button className="button icon secondary" type="button" title="Переместить выше" aria-label={`Переместить колонку ${column.name} выше`} onClick={() => move(index, -1)} disabled={index === 0 || isBusy}>
                  <ArrowUp size={16} />
                </button>
                <button className="button icon secondary" type="button" title="Переместить ниже" aria-label={`Переместить колонку ${column.name} ниже`} onClick={() => move(index, 1)} disabled={index === items.length - 1 || isBusy}>
                  <ArrowDown size={16} />
                </button>
                <button className="button icon danger" type="button" title={taskCount ? "Сначала перенесите задачи" : "Удалить колонку"} aria-label={`Удалить колонку ${column.name}`} onClick={() => setDeleteTarget(column)} disabled={taskCount > 0 || isBusy}>
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <p className="settings-manager-note">Переименование сохраняется после выхода из поля. Удалить можно только пустую колонку.</p>
      <ConfirmDialog
        confirmLabel="Удалить колонку"
        description={`Колонка «${deleteTarget?.name ?? ""}» будет удалена.`}
        open={Boolean(deleteTarget)}
        title="Удалить колонку?"
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) void remove(target.id);
        }}
      />
    </section>
  );
}
