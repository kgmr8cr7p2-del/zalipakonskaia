"use client";

import { Building2, Check, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type OilDepotItem = { id: string; name: string; active: boolean; tasks?: unknown[] };

export function OilDepotSettings({ oilDepots, canManage }: { oilDepots: OilDepotItem[]; canManage: boolean }) {
  const [items, setItems] = useState(oilDepots);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OilDepotItem | null>(null);
  const activeCount = items.filter((item) => item.active).length;

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) return;

    setError("");
    setIsAdding(true);
    try {
      const response = await fetch("/api/oil-depots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Не удалось создать нефтебазу");
      setItems((current) => [...current, { ...data.oilDepot, tasks: [] }]);
      form.reset();
    } finally {
      setIsAdding(false);
    }
  }

  async function update(item: OilDepotItem, payload: Partial<Pick<OilDepotItem, "name" | "active">>) {
    setError("");
    setPendingId(item.id);
    const response = await fetch(`/api/oil-depots/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setPendingId(null);
    if (!response.ok) return setError(data.error ?? "Не удалось сохранить нефтебазу");
    setItems((current) => current.map((currentItem) => (currentItem.id === item.id ? { ...currentItem, ...data.oilDepot } : currentItem)));
    showSaved(item.id);
  }

  async function remove(id: string) {
    setError("");
    setPendingId(id);
    const response = await fetch(`/api/oil-depots/${id}`, { method: "DELETE" });
    const data = await response.json();
    setPendingId(null);
    if (!response.ok) return setError(data.error ?? "Не удалось удалить нефтебазу");
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function showSaved(id: string) {
    setSavedId(id);
    window.setTimeout(() => setSavedId((current) => (current === id ? null : current)), 1_800);
  }

  if (!canManage) return null;

  return (
    <section className="settings-block settings-manager" aria-labelledby="oil-depots-title">
      <header className="settings-manager-head">
        <span className="settings-manager-icon settings-manager-icon-oil"><Building2 size={20} /></span>
        <div>
          <h2 id="oil-depots-title">Нефтебазы</h2>
          <p>Управляйте списком объектов, доступных в задачах и фильтрах.</p>
        </div>
        <span className="settings-summary-badge">{activeCount} из {items.length} активны</span>
      </header>

      <form className="settings-add-form" onSubmit={add}>
        <label className="field">
          <span>Новая нефтебаза</span>
          <input className="input" name="name" placeholder="Введите название объекта" required maxLength={120} />
        </label>
        <button className="button" disabled={isAdding}>
          <Plus size={18} />
          {isAdding ? "Добавляем…" : "Добавить нефтебазу"}
        </button>
      </form>

      {error ? <p className="settings-error" role="alert">{error}</p> : null}
      <div className="settings-list" aria-label="Нефтебазы">
        {items.map((item) => {
          const taskCount = item.tasks?.length ?? 0;
          const isBusy = pendingId === item.id;
          return (
            <article className={`settings-row oil-depot-row ${item.active ? "is-active" : "is-paused"}`} key={item.id}>
              <span className="oil-depot-status-mark" aria-hidden="true" />
              <label className="settings-name-field">
                <span className="visually-hidden">Название нефтебазы</span>
                <input
                  className="input"
                  defaultValue={item.name}
                  disabled={isBusy}
                  onBlur={(event) => {
                    const name = event.currentTarget.value.trim();
                    if (name && name !== item.name) void update(item, { name });
                  }}
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
              <label className="settings-switch">
                <input type="checkbox" checked={item.active} disabled={isBusy} onChange={(event) => void update(item, { active: event.currentTarget.checked })} />
                <span aria-hidden="true" />
                <b>{item.active ? "Активна" : "Скрыта"}</b>
              </label>
              <span className="settings-save-state" aria-live="polite">
                {isBusy ? "Сохраняем…" : savedId === item.id ? <><Check size={14} /> Сохранено</> : ""}
              </span>
              <button className="button icon danger" type="button" title={taskCount ? "Сначала отвяжите задачи" : "Удалить нефтебазу"} aria-label={`Удалить нефтебазу ${item.name}`} onClick={() => setDeleteTarget(item)} disabled={taskCount > 0 || isBusy}>
                <Trash2 size={17} />
              </button>
            </article>
          );
        })}
      </div>

      <p className="settings-manager-note">Скрытая нефтебаза остаётся в существующих задачах, но больше не предлагается при создании новых.</p>
      <ConfirmDialog
        confirmLabel="Удалить нефтебазу"
        description={`Нефтебаза «${deleteTarget?.name ?? ""}» будет удалена.`}
        open={Boolean(deleteTarget)}
        title="Удалить нефтебазу?"
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
