"use client";

import { CheckCircle2, ListChecks, Plus, Send, Trash2, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

type FormDataSource = {
  currentUser: { name: string };
  columns: Array<{ id: string; name: string }>;
  oilDepots: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
};

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: {
      close: () => void;
      expand: () => void;
      ready: () => void;
    };
  };
};

export function TelegramTaskCreator({ canCreate, data }: { canCreate: boolean; data: FormDataSource }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdTask, setCreatedTask] = useState<{ taskNumber: number; title: string } | null>(null);
  const [checklistItems, setChecklistItems] = useState([""]);

  useEffect(() => {
    const webApp = (window as TelegramWindow).Telegram?.WebApp;
    webApp?.ready();
    webApp?.expand();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: String(values.get("title") ?? ""),
          description: String(values.get("description") ?? ""),
          columnId: String(values.get("columnId") ?? ""),
          oilDepotId: String(values.get("oilDepotId") ?? "") || null,
          priority: String(values.get("priority") ?? "MEDIUM"),
          deadline: String(values.get("deadline") ?? "") || null,
          assigneeId: String(values.get("assigneeId") ?? "") || null,
          initialComment: String(values.get("initialComment") ?? "") || null,
          initialChecklist: values
            .getAll("initialChecklist")
            .map((item) => String(item).trim())
            .filter(Boolean),
          tags: [],
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Не удалось создать задачу");
        return;
      }
      setCreatedTask({ taskNumber: result.task.taskNumber, title: result.task.title });
      form.reset();
      setChecklistItems([""]);
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    const webApp = (window as TelegramWindow).Telegram?.WebApp;
    if (webApp) webApp.close();
    else window.location.href = "/board";
  }

  return (
    <section className="telegram-create-card">
      <header className="telegram-create-head">
        <div>
          <span>Team Kanban Board</span>
          <h1>Новая задача</h1>
          <p>Создаёт: {data.currentUser.name}</p>
        </div>
        <button className="button icon secondary" type="button" onClick={close} aria-label="Закрыть">
          <X size={18} />
        </button>
      </header>

      {!canCreate ? (
        <div className="telegram-create-state" role="alert">Ваша роль не позволяет создавать задачи.</div>
      ) : createdTask ? (
        <div className="telegram-create-success" role="status">
          <CheckCircle2 size={34} />
          <h2>Задача #{createdTask.taskNumber} создана</h2>
          <p>{createdTask.title}</p>
          <button className="button" type="button" onClick={() => setCreatedTask(null)}>Создать ещё</button>
          <button className="button secondary" type="button" onClick={close}>Закрыть</button>
        </div>
      ) : (
        <form className="telegram-create-form" onSubmit={submit} aria-busy={loading}>
          <label className="field">
            <span className="label">Название</span>
            <input className="input" name="title" required minLength={2} maxLength={180} autoFocus placeholder="Что нужно сделать" enterKeyHint="next" />
          </label>
          <label className="field">
            <span className="label">Нефтебаза</span>
            <select className="select" name="oilDepotId" defaultValue="">
              <option value="">Без нефтебазы</option>
              {data.oilDepots.map((depot) => <option key={depot.id} value={depot.id}>{depot.name}</option>)}
            </select>
          </label>
          <div className="telegram-create-grid">
            <label className="field">
              <span className="label">Статус</span>
              <select className="select" name="columnId" defaultValue={data.columns[0]?.id} required>
                {data.columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">Важность</span>
              <select className="select" name="priority" defaultValue="MEDIUM">
                <option value="LOW">Низкая</option>
                <option value="MEDIUM">Средняя</option>
                <option value="HIGH">Высокая</option>
                <option value="CRITICAL">Критическая</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span className="label">Исполнитель</span>
            <select className="select" name="assigneeId" defaultValue="">
              <option value="">Не назначен</option>
              {data.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Срок</span>
            <input className="input" name="deadline" type="date" />
          </label>
          <label className="field">
            <span className="label">Описание</span>
            <textarea className="textarea" name="description" rows={3} maxLength={4000} placeholder="Короткий контекст" />
          </label>
          <fieldset className="telegram-checklist">
            <legend>
              <ListChecks size={17} />
              Чек-лист
              <span>{checklistItems.filter((item) => item.trim()).length}</span>
            </legend>
            <div className="telegram-checklist-items">
              {checklistItems.map((item, index) => (
                <div className="telegram-checklist-row" key={index}>
                  <input
                    className="input"
                    name="initialChecklist"
                    value={item}
                    maxLength={240}
                    placeholder={index === 0 ? "Добавить пункт" : "Ещё один пункт"}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setChecklistItems((current) => current.map((currentItem, itemIndex) => itemIndex === index ? value : currentItem));
                    }}
                  />
                  {checklistItems.length > 1 ? (
                    <button
                      className="button icon secondary"
                      type="button"
                      aria-label={`Удалить пункт ${index + 1}`}
                      onClick={() => setChecklistItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <button className="button ghost telegram-checklist-add" type="button" onClick={() => setChecklistItems((current) => [...current, ""])}>
              <Plus size={17} />
              Добавить пункт
            </button>
          </fieldset>
          <label className="field">
            <span className="label">Первый комментарий</span>
            <textarea className="textarea" name="initialComment" rows={2} maxLength={2000} />
          </label>
          {error ? <p className="settings-error" role="alert">{error}</p> : null}
          <button className="button telegram-create-submit" disabled={loading} type="submit">
            <Send size={18} />
            {loading ? "Создаём…" : "Создать задачу"}
          </button>
        </form>
      )}
    </section>
  );
}
