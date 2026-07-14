"use client";

import { Archive, Bell, Building2, Calendar, Check, CheckSquare, ChevronDown, Download, Expand, Flag, ListChecks, Minimize2, MessageSquare, Monitor, Paperclip, Plus, Save, Search, Send, Trash2, UploadCloud, UserRound, X } from "lucide-react";
import { type DragEvent, type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreateTaskButton } from "@/components/CreateTaskButton";
import { TaskTimeline } from "@/components/TaskTimeline";
import { UserProfileButton } from "@/components/ProfileCard/ProfileCard";
import { setPresenceActivity } from "@/lib/presence";

const priorityLabels = {
  LOW: "Низкий",
  PLANNED: "Плановые работы",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  CRITICAL: "Критический",
};

type View = any;
type Task = any;
const emptyFilters = { q: "", priority: "", assignee: "", deadline: "", oilDepot: "" };
type Filters = typeof emptyFilters;
type ViewMode = "board" | "list" | "timeline" | "mine";

export function BoardClient({ initialView }: { initialView: View }) {
  const [view, setView] = useState(initialView);
  const [filters, setFilters] = useState<Filters>(readFiltersFromUrl);
  const filtersRef = useRef(filters);
  const [selected, setSelected] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([]);
  const [confirmation, setConfirmation] = useState<"archive" | "delete" | null>(null);
  const activityFingerprintRef = useRef(initialView?.activityLogs?.[0]?.id ?? "");
  const boardIdRef = useRef(initialView?.board?.id ?? "");

  const tasks = useMemo(() => view?.board?.columns?.flatMap((column: any) => column.tasks) ?? [], [view]);
  const visibleColumns = useMemo(
    () =>
      view?.board?.columns?.map((column: any) => ({
        ...column,
        tasks: viewMode === "mine" ? column.tasks.filter((task: Task) => taskAssigneeUsers(task).some((user: any) => user.id === view.currentUser.id)) : column.tasks,
      })) ?? [],
    [view, viewMode],
  );
  const visibleTasks = useMemo(() => visibleColumns.flatMap((column: any) => column.tasks), [visibleColumns]);
  const activeTask = selected ? tasks.find((task: Task) => task.id === selected.id) ?? selected : null;

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    setLastUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    if (createOpen) setPresenceActivity("Создаёт новую задачу");
    else if (activeTask) setPresenceActivity(`Работает с задачей #${activeTask.taskNumber}`);
    else setPresenceActivity(null);
    return () => setPresenceActivity(null);
  }, [createOpen, activeTask?.id, activeTask?.taskNumber]);

  function openTask(task: Task) {
    setError("");
    setCreateOpen(false);
    setSelected(task);
  }

  function openCreateTask() {
    setError("");
    setSelected(null);
    setCreateOpen(true);
  }

  async function refresh(nextFilters = filtersRef.current, options: { syncUrl?: boolean; boardId?: string } = {}) {
    const params = new URLSearchParams(Object.entries(nextFilters).filter(([, value]) => value));
    params.set("board", options.boardId ?? boardIdRef.current);
    const response = await fetch(`/api/board?${params.toString()}`);
    const data = await response.json();
    if (response.ok) {
      const latestActivity = data.activityLogs?.[0];
      if (latestActivity?.id && activityFingerprintRef.current && latestActivity.id !== activityFingerprintRef.current) {
        pushToast(`${activityLabel(latestActivity.action)}: ${latestActivity.task?.title ?? "доска"}`);
      }
      if (latestActivity?.id) activityFingerprintRef.current = latestActivity.id;
      boardIdRef.current = data.board.id;
      setView(data);
      setLastUpdatedAt(new Date());
      if (options.syncUrl) window.history.replaceState(null, "", params.toString() ? `/board?${params.toString()}` : "/board");
    } else {
      setError(data.error ?? "Не удалось обновить доску");
    }
  }

  function switchBoard(boardId: string) {
    setSelected(null);
    setCreateOpen(false);
    setError("");
    void refresh(filtersRef.current, { boardId, syncUrl: true });
  }

  function pushToast(text: string) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current.slice(-3), { id, text }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 6000);
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !createOpen && !selected) {
        void refresh(filtersRef.current);
      }
    }, 10000);
    return () => window.clearInterval(timer);
  }, [createOpen, selected]);

  useEffect(() => {
    if (!createOpen && !selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setError("");
      setCreateOpen(false);
      setSelected(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [createOpen, selected]);

  useEffect(() => {
    document.documentElement.dataset.boardFocus = focusMode ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.boardFocus;
    };
  }, [focusMode]);

  useEffect(() => {
    const syncFullscreenState = () => {
      if (!document.fullscreenElement) setFocusMode(false);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  async function toggleFocusMode() {
    const next = !focusMode;
    setFocusMode(next);
    if (next && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    } else if (!next && document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
  }

  function updateFilter(name: keyof Filters, value: string) {
    const next = { ...filtersRef.current, [name]: value };
    filtersRef.current = next;
    setFilters(next);
    void refresh(next, { syncUrl: true });
  }

  function resetFilters() {
    const next = { ...emptyFilters };
    filtersRef.current = next;
    setFilters(next);
    void refresh(next, { syncUrl: true });
  }

  function preventFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  async function createTask(formData: FormData) {
    setError("");
    const payload = taskPayload(formData);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Не удалось создать задачу");
      return;
    }
    setCreateOpen(false);
    await refresh();
  }

  async function saveTask(formData: FormData) {
    if (!activeTask) return;
    const payload = taskPayload(formData);
    const response = await fetch(`/api/tasks/${activeTask.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Не удалось сохранить задачу");
      return;
    }
    setSelected(data.task);
    await refresh();
  }

  async function archiveTask() {
    if (!activeTask) return;
    const response = await fetch(`/api/tasks/${activeTask.id}/archive`, { method: "POST" });
    if (response.ok) {
      setSelected(null);
      await refresh();
    } else {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Не удалось перенести задачу в архив");
    }
  }

  async function deleteTask() {
    if (!activeTask) return;
    const response = await fetch(`/api/tasks/${activeTask.id}`, { method: "DELETE" });
    if (response.ok) {
      setSelected(null);
      await refresh();
    } else {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Не удалось удалить задачу");
    }
  }

  function handleDragStart(event: DragEvent<HTMLDivElement>, taskId: string) {
    setDraggingId(taskId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
  }

  async function moveTask(columnId: string, taskId = draggingId) {
    if (!taskId) return;
    setDropColumn(null);
    const response = await fetch(`/api/tasks/${taskId}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ columnId, position: 0 }),
    });
    setDraggingId(null);
    if (response.ok) await refresh();
  }

  async function addComment(formData: FormData) {
    if (!activeTask) return;
    const text = String(formData.get("text") ?? "");
    const response = await fetch(`/api/tasks/${activeTask.id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (response.ok) await refresh();
  }

  async function addChecklistItem(formData: FormData) {
    if (!activeTask) return;
    setError("");
    const text = String(formData.get("text") ?? "").trim();
    if (!text) return;

    let checklist = activeTask.checklists[0];
    if (!checklist) {
      const createdResponse = await fetch(`/api/tasks/${activeTask.id}/checklists`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Чек-лист" }),
      });
      const created = await createdResponse.json().catch(() => ({}));
      if (!createdResponse.ok || !created.checklist?.id) {
        setError(created.error ?? "Не удалось создать чеклист");
        return;
      }
      checklist = created.checklist;
    }

    const response = await fetch(`/api/checklists/${checklist.id}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Не удалось добавить пункт чеклиста");
      return;
    }
    await refresh();
  }

  async function toggleChecklistItem(id: string, completed: boolean) {
    await fetch(`/api/checklist-items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    await refresh();
  }

  async function deleteChecklistItem(id: string) {
    setError("");
    const response = await fetch(`/api/checklist-items/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Не удалось удалить пункт чек-листа");
      return;
    }
    await refresh();
  }

  async function uploadFile(formData: FormData) {
    if (!activeTask) return;
    await fetch(`/api/tasks/${activeTask.id}/files`, { method: "POST", body: formData });
    await refresh();
  }

  return (
    <>
      <div className="topbar board-topbar">
        <form className="toolbar filters-compact filters-live" onSubmit={preventFilterSubmit}>
          <label className="field search compact-field">
            <span className="meta-row search-shell">
              <Search size={17} />
              <input className="input compact-input" name="q" placeholder="Поиск" aria-label="Поиск по задачам" value={filters.q} onChange={(event) => updateFilter("q", event.currentTarget.value)} />
            </span>
          </label>
          {!view.board.ownerId ? <select className="select compact-select depot-filter" name="oilDepot" aria-label="Фильтр по нефтебазе" value={filters.oilDepot} onChange={(event) => updateFilter("oilDepot", event.currentTarget.value)}>
            <option value="">Нефтебаза</option>
            {view.oilDepots.map((depot: any) => (
              <option key={depot.id} value={depot.id}>
                {depot.name}
              </option>
            ))}
          </select> : null}
          <select className="select compact-select" name="priority" aria-label="Фильтр по приоритету" value={filters.priority} onChange={(event) => updateFilter("priority", event.currentTarget.value)}>
            <option value="">Приоритет</option>
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {!view.board.ownerId ? <select className="select compact-select" name="assignee" aria-label="Фильтр по исполнителю" value={filters.assignee} onChange={(event) => updateFilter("assignee", event.currentTarget.value)}>
            <option value="">Исполнитель</option>
            {view.users.map((user: any) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select> : null}
          <select className="select compact-select" name="deadline" aria-label="Фильтр по сроку" value={filters.deadline} onChange={(event) => updateFilter("deadline", event.currentTarget.value)}>
            <option value="">Дедлайн</option>
            <option value="week">На этой неделе</option>
            <option value="overdue">Просрочено</option>
          </select>
          <button className="button secondary compact-button reset-filter-button" type="button" title="Сбросить фильтры" onClick={resetFilters}>
            <X size={17} />
            Сбросить
          </button>
        </form>
        <form className="toolbar filters-compact filters-legacy" onSubmit={preventFilterSubmit}>
          <label className="field search compact-field">
            <span className="meta-row search-shell">
              <Search size={17} />
              <input className="input compact-input" name="q" placeholder="Поиск" aria-label="Поиск по задачам" defaultValue={filters.q} />
            </span>
          </label>
          <select className="select compact-select" name="priority" aria-label="Фильтр по приоритету" defaultValue={filters.priority}>
            <option value="">Приоритет</option>
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {!view.board.ownerId ? <select className="select compact-select" name="assignee" aria-label="Фильтр по исполнителю" defaultValue={filters.assignee}>
            <option value="">Исполнитель</option>
            {view.users.map((user: any) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select> : null}
          <select className="select compact-select" name="deadline" aria-label="Фильтр по дедлайну" defaultValue={filters.deadline}>
            <option value="">Дедлайн</option>
            <option value="week">На этой неделе</option>
            <option value="overdue">Просрочено</option>
          </select>
          <button className="button secondary compact-button" title="Применить фильтры">
            <Search size={17} />
          </button>
        </form>
        <span className="spacer" />
        <span className="sync-pill mobile-optional" title="Доска обновляется автоматически каждые 10 секунд">
          {lastUpdatedAt ? `Обновлено ${timeOnly(lastUpdatedAt)}` : "Обновляется"}
        </span>
        <button className="button secondary compact-button mobile-optional" type="button" onClick={() => void toggleFocusMode()} title="Режим просмотра доски">
          <Expand size={17} />
          Доска
        </button>
        <a className="button secondary compact-button mobile-optional" href="/board/tv" title="TV-режим для офисного экрана">
          <Monitor size={17} />
          TV
        </a>
        <a className="button secondary board-export mobile-optional" href={`/api/export?${new URLSearchParams([...Object.entries(filters).filter(([, value]) => value), ["board", view.board.id]]).toString()}`}>
          <Download size={17} />
          Excel
        </a>
      </div>

      {focusMode ? (
        <button className="button focus-exit" type="button" onClick={() => void toggleFocusMode()}>
          <Minimize2 size={17} />
          Выйти из просмотра
        </button>
      ) : null}

      <div className={`content board-content ${focusMode ? "focus-mode" : ""}`}>
        <div className="board-head">
          <div className="board-copy">
            <h1>{view.board.name}</h1>
            <label className="board-switcher">
              <span className="visually-hidden">Выбрать доску</span>
              <select className="select" value={view.board.id} onChange={(event) => switchBoard(event.currentTarget.value)}>
                {view.availableBoards.map((board: any) => (
                  <option key={board.id} value={board.id}>
                    {board.ownerId ? `Личная · ${board.name}` : `Общая · ${board.name}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <span className="spacer" />
          <div className="board-view-tabs board-view-tabs-inline" role="tablist" aria-label="Режим отображения">
            <button className={viewMode === "board" ? "active" : ""} type="button" onClick={() => setViewMode("board")}>Доска</button>
            <button className={viewMode === "list" ? "active" : ""} type="button" onClick={() => setViewMode("list")}>Список</button>
            <button className={viewMode === "timeline" ? "active" : ""} type="button" onClick={() => setViewMode("timeline")}>Таймлайн</button>
            {!view.board.ownerId ? <button className={viewMode === "mine" ? "active" : ""} type="button" onClick={() => setViewMode("mine")}>Моя работа</button> : null}
          </div>
          {view.permissions.canCreateTask ? (
            <CreateTaskButton onClick={openCreateTask} />
          ) : null}
          {view.permissions.canCreateTask ? (
            <form className="toolbar quick-create" action={createTask}>
              <input type="hidden" name="columnId" value={view.board.columns[0]?.id ?? ""} />
              <input type="hidden" name="oilDepotId" value="" />
              <input className="input" name="title" placeholder="Новая задача" required />
              <select className="select" name="priority" defaultValue="MEDIUM">
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button className="button">
                <Plus size={17} />
                Создать
              </button>
            </form>
          ) : null}
        </div>
        {error && !createOpen && !activeTask ? <p className="chip priority-HIGH" role="alert">{error}</p> : null}
        {viewMode === "list" ? <TaskTable tasks={visibleTasks} onOpen={openTask} personal={Boolean(view.board.ownerId)} /> : null}
        {viewMode === "timeline" ? <TaskTimeline tasks={tasks} onOpen={openTask} /> : null}
        <section className={`board ${viewMode === "list" || viewMode === "timeline" ? "is-hidden" : ""}`} aria-label="Канбан-доска">
          {visibleColumns.map((column: any) => (
            <article
              className={`column ${dropColumn === column.id ? "drop-target" : ""}`}
              key={column.id}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropColumn(column.id);
              }}
              onDragEnter={() => setDropColumn(column.id)}
              onDragLeave={() => setDropColumn(null)}
              onDrop={(event) => {
                event.preventDefault();
                void moveTask(column.id, event.dataTransfer.getData("text/plain") || draggingId);
              }}
            >
              <header className="column-head">
                <strong>{column.name}</strong>
                <span className="count">{column.tasks.length}</span>
              </header>
              <div className="task-list">
                {column.tasks.length ? (
                  column.tasks.map((task: Task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      dragging={draggingId === task.id}
                      onOpen={() => openTask(task)}
                      onDragStart={(event) => handleDragStart(event, task.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropColumn(null);
                      }}
                    />
                  ))
                ) : (
                  <div className="empty">Здесь пока нет задач</div>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>

      {activeTask ? (
        <aside className="task-drawer-backdrop" aria-label="Панель задачи">
          <div className="task-drawer t-panel-slide" data-open="true" role="dialog" aria-modal="false" aria-labelledby="task-dialog-title">
          <TaskDialogV2
            task={activeTask}
            view={view}
            canDelete={view.permissions.canDeleteTask}
            onClose={() => { setError(""); setSelected(null); }}
            onSave={saveTask}
            onArchive={() => setConfirmation("archive")}
            onDelete={() => setConfirmation("delete")}
            onAddComment={addComment}
            onAddChecklistItem={addChecklistItem}
            onToggleChecklistItem={toggleChecklistItem}
            onDeleteChecklistItem={deleteChecklistItem}
            onUploadFile={uploadFile}
            error={error}
          />
          </div>
        </aside>
      ) : null}
      {createOpen ? (
        <aside className="task-drawer-backdrop" aria-label="Создание задачи">
          <div className="task-drawer t-panel-slide" data-open="true" role="dialog" aria-modal="false" aria-labelledby="create-task-title">
            <CreateTaskDialogV2 view={view} error={error} onClose={() => { setError(""); setCreateOpen(false); }} onCreate={createTask} />
          </div>
        </aside>
      ) : null}
      <ConfirmDialog
        confirmLabel={confirmation === "delete" ? "Удалить навсегда" : "Перенести в архив"}
        description={
          confirmation === "delete"
            ? "Задача будет удалена безвозвратно и перестанет учитываться в отчётах."
            : "Задача исчезнет с доски, но останется доступна в архиве и отчётах."
        }
        open={confirmation !== null}
        title={confirmation === "delete" ? "Удалить задачу?" : "Перенести задачу в архив?"}
        tone={confirmation === "delete" ? "danger" : "default"}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          const action = confirmation;
          setConfirmation(null);
          if (action === "delete") void deleteTask();
          if (action === "archive") void archiveTask();
        }}
      />
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            <strong>Изменение</strong>
            <span>{toast.text}</span>
            <button className="button icon secondary" type="button" title="Закрыть" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function TaskTable({ tasks, onOpen, personal }: { tasks: Task[]; onOpen: (task: Task) => void; personal: boolean }) {
  return (
    <section className={`task-table-panel ${personal ? "task-table-personal" : ""}`} aria-label="Список задач">
      <div className="task-table-row task-table-head">
        <span>Задача</span>
        <span>Статус</span>
        {!personal ? <span>Нефтебаза</span> : null}
        {!personal ? <span>Исполнитель</span> : null}
        <span>Срок</span>
        <span>Приоритет</span>
      </div>
      {tasks.length ? (
        tasks.map((task) => (
          <button className="task-table-row" type="button" key={task.id} onClick={() => onOpen(task)}>
            <strong>#{task.taskNumber} {task.title}</strong>
            <span data-label="Статус">{task.column?.name ?? "Без статуса"}</span>
            {!personal ? <span data-label="Нефтебаза">{task.oilDepot?.name ?? "Без нефтебазы"}</span> : null}
            {!personal ? <span data-label="Исполнители">{taskAssigneeUsers(task).map((user: any) => user.name).join(", ") || "Не назначены"}</span> : null}
            <span data-label="Срок" className={deadlineTone(task)}>{task.deadline ? deadlineText(task) : "Без срока"}</span>
            <span data-label="Приоритет">{priorityLabels[task.priority as keyof typeof priorityLabels]}</span>
          </button>
        ))
      ) : (
        <div className="empty">Задач в этом представлении нет.</div>
      )}
    </section>
  );
}

function TaskCard({
  task,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const checklist = checklistProgress(task);
  const deadlineState = task.deadline ? deadlineText(task) : "";
  return (
    <div
      className={`task-card priority-card-${task.priority} ${dragging ? "dragging" : ""}`}
      role="button"
      tabIndex={0}
      draggable
      aria-label={`Открыть задачу: ${task.title}`}
      onClick={onOpen}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
        if (event.key === " ") event.preventDefault();
      }}
      onKeyUp={(event) => {
        if (event.key === " ") onOpen();
      }}
    >
      <span className="task-title">
        <span className="task-number">#{task.taskNumber}</span>
        {task.title}
      </span>
      {task.oilDepot ? (
        <div className="task-depot">
          <span className="task-depot-icon" aria-hidden="true">
            <Building2 size={14} />
          </span>
          <span className="task-depot-copy">
            <small>Нефтебаза</small>
            <strong>{task.oilDepot.name}</strong>
          </span>
        </div>
      ) : null}
      {task.description ? <p className="task-description">{task.description}</p> : null}
      <div className="meta-row">
        <span className={`chip priority-${task.priority}`}>{priorityLabels[task.priority as keyof typeof priorityLabels]}</span>
        {taskAssigneeUsers(task).map((user: any) => <span className="chip" key={user.id}>{user.name}</span>)}
      </div>
      <div className="meta-row">
        {task.deadline ? (
          <span className={`chip ${deadlineTone(task)}`}>
            <Calendar size={13} />
            {deadlineState}
          </span>
        ) : null}
        {task.reminderDaysBefore != null ? (
          <span className="chip reminder-chip" title={`Telegram-напоминание: ${reminderLabel(task.reminderDaysBefore)}`}>
            <Bell size={13} />
            {reminderLabel(task.reminderDaysBefore)}
          </span>
        ) : null}
        {task.comments.length ? (
          <span className="chip">
            <MessageSquare size={13} />
            {task.comments.length}
          </span>
        ) : null}
        {task.fileAttachments.length ? (
          <span className="chip">
            <Paperclip size={13} />
            {task.fileAttachments.length}
          </span>
        ) : null}
        {task.tags.map((item: any) => (
          <span className="chip" key={item.tag.id}>
            {item.tag.name}
          </span>
        ))}
      </div>
      {checklist.total ? (
        <div className="progress" aria-label={`Чек-лист выполнен на ${checklist.percent}%`}>
          <span style={{ inlineSize: `${checklist.percent}%`, width: `${checklist.percent}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function CreateTaskDialog(props: { view: View; onClose: () => void; onCreate: (formData: FormData) => void }) {
  const isPersonalBoard = Boolean(props.view.board.ownerId);
  return (
    <section className="dialog-section create-task-form">
      <div className="toolbar">
        <div>
          <h2 id="create-task-title">Новая задача</h2>
          <p className="muted">Заполните детали до создания карточки.</p>
        </div>
        <span className="spacer" />
        <button className="button icon secondary" type="button" title="Закрыть" onClick={props.onClose}>
          <X size={18} />
        </button>
      </div>
      <form className="form task-editor-form" action={props.onCreate}>
        {isPersonalBoard ? <><input type="hidden" name="oilDepotId" value="" /><input type="hidden" name="assigneeId" value="" /></> : <label className="field highlighted-field">
          <span className="label">Нефтебаза</span>
          <select className="select" name="oilDepotId" defaultValue="">
            <option value="">
              Без нефтебазы
            </option>
            {props.view.oilDepots
              .filter((depot: any) => depot.active)
              .map((depot: any) => (
                <option key={depot.id} value={depot.id}>
                  {depot.name}
                </option>
              ))}
          </select>
        </label>}
        <label className="field">
          <span className="label">Название</span>
          <input className="input" name="title" placeholder="Что нужно сделать" required autoFocus />
        </label>
        <label className="field">
          <span className="label">Описание</span>
          <textarea className="textarea compact-textarea" name="description" placeholder="Контекст, ссылки, ожидания" />
        </label>
        <label className="field">
          <span className="label">Комментарий</span>
          <textarea className="textarea compact-textarea" name="initialComment" placeholder="Первый комментарий к задаче" />
        </label>
        <div className="grid-2">
          <label className="field">
            <span className="label">Статус</span>
            <select className="select" name="columnId" defaultValue={props.view.board.columns[0]?.id ?? ""} required>
              {props.view.board.columns.map((column: any) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Важность</span>
            <select className="select" name="priority" defaultValue="MEDIUM">
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Начало работы</span>
            <input className="input" type="date" name="startDate" title="Если не указать дату, будет использована дата создания задачи" />
          </label>
          <label className="field">
            <span className="label">Дедлайн</span>
            <input className="input" type="date" name="deadline" required />
          </label>
          {!isPersonalBoard ? <label className="field">
            <span className="label">Исполнитель</span>
            <select className="select" name="assigneeId" defaultValue="">
              <option value="">Не назначен</option>
              {props.view.users.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label> : null}
        </div>
        <div className="toolbar">
          <button className="button">
            <Plus size={17} />
            Создать задачу
          </button>
          <button className="button secondary" type="button" onClick={props.onClose}>
            Отмена
          </button>
        </div>
      </form>
    </section>
  );
}

function TaskDialog(props: {
  task: Task;
  view: View;
  canDelete: boolean;
  onClose: () => void;
  onSave: (formData: FormData) => void;
  onArchive: () => void;
  onDelete: () => void;
  onAddComment: (formData: FormData) => void;
  onAddChecklistItem: (formData: FormData) => void;
  onToggleChecklistItem: (id: string, completed: boolean) => void;
  onDeleteChecklistItem: (id: string) => void;
  onUploadFile: (formData: FormData) => void;
}) {
  const checklist = props.task.checklists[0];
  const checklistStats = checklistProgress(props.task);
  const isPersonalBoard = Boolean(props.view.board.ownerId);

  return (
    <div className="dialog-grid">
      <section className="dialog-section">
        <div className="toolbar">
          <div>
            <span className="modal-kicker">Задача #{props.task.taskNumber}</span>
            <h2 id="task-dialog-title">{props.task.title}</h2>
          </div>
          <span className="spacer" />
          <button className="button icon secondary" type="button" title="Закрыть" onClick={props.onClose}>
            <X size={18} />
          </button>
        </div>
        <form className="form task-editor-form" action={props.onSave}>
          {isPersonalBoard ? <><input type="hidden" name="oilDepotId" value="" /><input type="hidden" name="assigneeId" value="" /></> : <label className="field highlighted-field">
            <span className="label">Нефтебаза</span>
            <select className="select" name="oilDepotId" defaultValue={props.task.oilDepotId ?? ""}>
              <option value="">Без нефтебазы</option>
              {props.view.oilDepots.map((depot: any) => (
                <option key={depot.id} value={depot.id}>
                  {depot.name}
                  {depot.active ? "" : " (неактивна)"}
                </option>
              ))}
            </select>
          </label>}
          <label className="field">
            <span className="label">Название</span>
            <input className="input" name="title" defaultValue={props.task.title} required />
          </label>
          <label className="field">
            <span className="label">Описание</span>
            <textarea className="textarea" name="description" defaultValue={props.task.description} />
          </label>
          <input type="hidden" name="columnId" value={props.task.columnId} />
          <div className="grid-2">
            <label className="field">
              <span className="label">Статус</span>
              <select className="select" name="displayColumnId" defaultValue={props.task.columnId} disabled>
                {props.view.board.columns.map((column: any) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Приоритет</span>
              <select className="select" name="priority" defaultValue={props.task.priority}>
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Начало работы</span>
              <input className="input" type="date" name="startDate" defaultValue={String(props.task.startDate ?? props.task.createdAt).slice(0, 10)} />
            </label>
            <label className="field">
              <span className="label">Дедлайн</span>
              <input className="input" type="date" name="deadline" required defaultValue={props.task.deadline ? String(props.task.deadline).slice(0, 10) : ""} />
            </label>
            {!isPersonalBoard ? <label className="field">
              <span className="label">Исполнитель</span>
              <select className="select" name="assigneeId" defaultValue={props.task.assigneeId ?? ""}>
                <option value="">Не назначен</option>
                {props.view.users.map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label> : null}
          </div>
          <div className="toolbar">
            <button className="button">
              <Save size={17} />
              Сохранить
            </button>
            {props.canDelete ? (
              <button className="button secondary" type="button" title="Перенести задачу в архив" onClick={props.onArchive}>
                <Archive size={17} />
                В архив
              </button>
            ) : null}
            {props.canDelete ? (
              <button className="button danger" type="button" title="Удалить задачу навсегда" onClick={props.onDelete}>
                <Trash2 size={17} />
                Удалить
              </button>
            ) : null}
          </div>
        </form>

        <section className="dialog-section">
          <h3>Комментарии</h3>
          <div className="chat-list">
            {props.task.comments.map((comment: any) => (
              <div className={`chat-message ${comment.author.id === props.view.currentUser.id ? "own" : ""}`} key={comment.id}>
                <div className="chat-comment-head">
                  <UserProfileButton user={comment.author} viewerId={props.view.currentUser.id} size={30} />
                  <div className="chat-meta">
                    <strong>{comment.author.name}</strong>
                    <span>{dateTime(comment.createdAt)}</span>
                  </div>
                </div>
                <p className="chat-text">{comment.text}</p>
              </div>
            ))}
          </div>
          <form className="toolbar chat-composer" action={props.onAddComment}>
            <input className="input" name="text" placeholder="Добавить комментарий" required />
            <button className="button secondary">
              <MessageSquare size={17} />
              Отправить
            </button>
          </form>
        </section>
      </section>

      <aside className="dialog-section">
        <section className="panel">
          <h3>Чек-лист</h3>
          {checklistStats.total ? (
            <div className="checklist-progress">
              <div className="progress" aria-label={`Чек-лист выполнен на ${checklistStats.percent}%`}>
                <span style={{ inlineSize: `${checklistStats.percent}%`, width: `${checklistStats.percent}%` }} />
              </div>
              <span className="muted">
                {checklistStats.completed} из {checklistStats.total}
              </span>
            </div>
          ) : null}
          <div className="list">
            {checklist?.items?.length ? (
              checklist.items.map((item: any) => (
                <div className="line-item checklist-line-item" key={item.id}>
                  <label className="checklist-toggle">
                    <input type="checkbox" defaultChecked={item.completed} onChange={(event) => props.onToggleChecklistItem(item.id, event.target.checked)} />
                    <span>{item.text}</span>
                  </label>
                  <button
                    className="button icon secondary checklist-delete"
                    type="button"
                    title="Удалить пункт"
                    aria-label={`Удалить пункт «${item.text}»`}
                    onClick={() => props.onDeleteChecklistItem(item.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            ) : (
              <p className="muted">Пунктов пока нет.</p>
            )}
          </div>
          <form className="toolbar" action={props.onAddChecklistItem}>
            <input className="input" name="text" placeholder="Новый пункт" required />
            <button className="button icon secondary" title="Добавить пункт">
              <Plus size={17} />
            </button>
          </form>
        </section>

        <section className="panel">
          <h3>Файлы</h3>
          <div className="list">
            {props.task.fileAttachments.map((file: any) => (
              <a className="line-item file-line" key={file.id} href={file.url} target="_blank">
                <Paperclip size={16} />
                <span>
                  <strong>{file.fileName}</strong>
                  <small>Добавил: {file.uploader?.name ?? "Неизвестно"}</small>
                </span>
              </a>
            ))}
          </div>
          <form className="form" action={props.onUploadFile}>
            <input className="input" type="file" name="file" required />
            <button className="button secondary">
              <Paperclip size={17} />
              Прикрепить
            </button>
          </form>
        </section>

        <section className="panel">
          <h3>История</h3>
          <div className="list">
            {props.task.activityLogs.map((log: any) => (
              <div className="line-item" key={log.id}>
                <CheckSquare size={15} />
                <span>{activityLabel(log.action)}</span>
                <span className="muted">{dateTime(log.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function CreateTaskDialogV2(props: { view: View; error?: string; onClose: () => void; onCreate: (formData: FormData) => void }) {
  const firstColumn = props.view.board.columns[0];
  const isPersonalBoard = Boolean(props.view.board.ownerId);
  const [checklistItems, setChecklistItems] = useState([""]);

  return (
    <section className="task-modal-v2">
      <header className="task-modal-v2-head">
        <div>
          <h2 id="create-task-title">Новая задача</h2>
          <div className="modal-badges compact">
            <span className="modal-badge badge-purple"><span className="status-dot" />{firstColumn?.name ?? "Не выбрана"}</span>
            {!isPersonalBoard ? <span className="modal-badge badge-purple-soft"><Building2 size={15} />Без нефтебазы</span> : null}
          </div>
        </div>
        <button className="button icon secondary modal-close" type="button" title="Закрыть" onClick={props.onClose}>
          <X size={18} />
        </button>
      </header>

      <form className="task-modal-v2-form" action={props.onCreate}>
        {isPersonalBoard ? <><input type="hidden" name="oilDepotId" value="" /><input type="hidden" name="assigneeId" value="" /></> : null}
        <div className="task-modal-layout task-create-layout">
          <div className="task-modal-main">
            <section className="modal-field-stack">
              <label className="field">
                <span className="label">Название</span>
                <input className="input" name="title" placeholder="Что нужно сделать?" required autoFocus />
              </label>
              <label className="field">
                <span className="label">Описание</span>
                <textarea className="textarea modal-description" name="description" placeholder="Добавьте контекст, ссылки, критерии готовности..." />
              </label>
            </section>

            <section className="modal-work-grid modal-create-work-grid" aria-label="Рабочие блоки задачи">
              <article className="modal-mini-panel">
                <header>
                  <span>
                    <CheckSquare size={18} />
                    Чеклист
                  </span>
                  <b>0/0</b>
                </header>
                <div className="checklist-draft">
                  {checklistItems.map((item, index) => (
                    <div className="checklist-draft-row" key={index}>
                      <input
                        className="input"
                        name="initialChecklist"
                        placeholder={index === 0 ? "Добавить пункт чеклиста" : "Еще один пункт"}
                        value={item}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value;
                          setChecklistItems((current) => current.map((value, itemIndex) => (itemIndex === index ? nextValue : value)));
                        }}
                      />
                      {checklistItems.length > 1 ? (
                        <button className="button icon secondary" type="button" title="Удалить пункт" onClick={() => setChecklistItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                          <X size={15} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button className="button ghost add-checklist-draft" type="button" onClick={() => setChecklistItems((current) => [...current, ""])}>
                    <Plus size={19} />
                    Добавить пункт
                  </button>
                </div>
              </article>

              <article className="modal-mini-panel">
                <header>
                  <span>
                    <Paperclip size={18} />
                    Файлы
                  </span>
                </header>
                <div className="upload-placeholder">
                  <UploadCloud size={22} />
                  <span>Файлы можно прикрепить после создания задачи</span>
                </div>
              </article>
            </section>

            <article className="modal-mini-panel modal-create-comments">
              <header>
                <span>
                  <MessageSquare size={18} />
                  Комментарии
                </span>
                <span className="chevron">⌄</span>
              </header>
              <textarea className="textarea modal-comment-input" name="initialComment" placeholder="Первый комментарий к задаче" />
            </article>
          </div>

          <aside className="modal-properties modal-properties-aside">
            <h3>Свойства</h3>
            <div className="property-grid">
              <label className="field modal-property-field">
                <span className="property-icon"><ListChecks size={19} /></span>
                <span className="label">Статус</span>
                <select className="select" name="columnId" defaultValue={firstColumn?.id ?? ""} required>
                  {props.view.board.columns.map((column: any) => (
                    <option key={column.id} value={column.id}>
                      {column.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field modal-property-field">
                <span className="property-icon"><Flag size={19} /></span>
                <span className="label">Приоритет</span>
                <select className="select" name="priority" defaultValue="MEDIUM">
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field modal-property-field">
                <span className="property-icon"><Calendar size={19} /></span>
                <span className="label">Начало работы</span>
                <input className="input" type="date" name="startDate" title="Если не указать дату, будет использована дата создания задачи" />
                <small className="modal-property-help">Если пусто — дата создания</small>
              </label>
              <label className="field modal-property-field">
                <span className="property-icon"><Calendar size={19} /></span>
                <span className="label">Дедлайн</span>
                <input className="input" type="date" name="deadline" required />
              </label>
              <ReminderFields personal={isPersonalBoard} />
              {!isPersonalBoard ? <label className="field modal-property-field">
                <span className="property-icon"><Building2 size={19} /></span>
                <span className="label">Нефтебаза</span>
                <select className="select" name="oilDepotId" defaultValue="">
                  <option value="">Без нефтебазы</option>
                  {props.view.oilDepots
                    .filter((depot: any) => depot.active)
                    .map((depot: any) => (
                    <option key={depot.id} value={depot.id}>
                      {depot.name}
                    </option>
                  ))}
                </select>
              </label> : null}
              {!isPersonalBoard ? <AssigneePicker users={props.view.users} /> : null}
            </div>
          </aside>
        </div>

        <footer className="task-modal-v2-actions">
          {props.error ? <p className="task-modal-error" role="alert">{props.error}</p> : null}
          <button className="button secondary" type="button" onClick={props.onClose}>
            Отмена
          </button>
          <button className="button">
            <Plus size={17} />
            Создать задачу
          </button>
        </footer>
      </form>
    </section>
  );
}

function TaskDialogV2(props: {
  task: Task;
  view: View;
  canDelete: boolean;
  onClose: () => void;
  onSave: (formData: FormData) => void;
  onArchive: () => void;
  onDelete: () => void;
  onAddComment: (formData: FormData) => void;
  onAddChecklistItem: (formData: FormData) => void;
  onToggleChecklistItem: (id: string, completed: boolean) => void;
  onDeleteChecklistItem: (id: string) => void;
  onUploadFile: (formData: FormData) => void;
  error?: string;
}) {
  const checklist = props.task.checklists[0];
  const checklistStats = checklistProgress(props.task);
  const editFormId = `task-edit-${props.task.id}`;
  const isPersonalBoard = Boolean(props.view.board.ownerId);

  return (
    <section className="task-modal-v2">
      <header className="task-modal-v2-head">
        <div>
          <h2 id="task-dialog-title">
            #{props.task.taskNumber} {props.task.title}
          </h2>
          <div className="modal-badges">
            <span className="modal-badge badge-purple"><span className="status-dot" />{props.task.column.name}</span>
            {!isPersonalBoard ? <span className="modal-badge badge-blue"><span className="status-dot" />{props.task.oilDepot?.name ?? "Без нефтебазы"}</span> : null}
            <span className="modal-badge badge-green"><span className="status-dot" />{priorityLabels[props.task.priority as keyof typeof priorityLabels]} приоритет</span>
          </div>
        </div>
        <button className="button icon secondary modal-close" type="button" title="Закрыть" onClick={props.onClose}>
          <X size={18} />
        </button>
      </header>

      <form id={editFormId} className="sr-form" action={props.onSave} />
      {isPersonalBoard ? <><input form={editFormId} type="hidden" name="oilDepotId" value="" /><input form={editFormId} type="hidden" name="assigneeId" value="" /></> : null}

      <div className="task-modal-layout task-edit-layout">
        <div className="task-modal-main">
          <section className="modal-field-stack">
            <label className="field">
              <span className="label">Название</span>
              <input className="input" form={editFormId} name="title" defaultValue={props.task.title} required />
            </label>
            <label className="field">
              <span className="label">Описание</span>
              <textarea className="textarea modal-description edit-description" form={editFormId} name="description" defaultValue={props.task.description} placeholder="Добавьте описание задачи, детали, ссылки или требования..." maxLength={1000} />
              <span className="field-counter">{props.task.description?.length ?? 0}/1000</span>
            </label>
            <input form={editFormId} type="hidden" name="columnId" value={props.task.columnId} />
          </section>

          <section className="modal-work-grid modal-work-grid-task" aria-label="Рабочие блоки задачи">
        <article className="modal-mini-panel modal-comments-panel edit-comments-panel">
          <header>
            <span>
              <MessageSquare size={15} />
              Комментарии
            </span>
            <b>{props.task.comments.length}</b>
          </header>
          <div className="modal-comments-list">
            {props.task.comments.length ? (
              props.task.comments.map((comment: any) => (
                <div className="modal-comment" key={comment.id}>
                  <div className="modal-comment-author">
                    <UserProfileButton user={comment.author} viewerId={props.view.currentUser.id} size={32} />
                    <span>
                      <strong>{comment.author.name}</strong>
                      <small>{dateTime(comment.createdAt)}</small>
                    </span>
                  </div>
                  <p>{comment.text}</p>
                </div>
              ))
            ) : (
              <p className="muted">Комментариев пока нет.</p>
            )}
          </div>
          <form className="modal-inline-form modal-comment-form" action={props.onAddComment}>
            <textarea className="textarea modal-comment-input" name="text" placeholder="Напишите комментарий..." required />
            <button className="button modal-comment-send" title="Отправить комментарий">
              <Send size={16} />
              Отправить
            </button>
          </form>
        </article>

        <article className="modal-mini-panel">
          <header>
            <span>
              <CheckSquare size={15} />
              Чеклист
            </span>
            <b>{checklistStats.completed}/{checklistStats.total}</b>
          </header>
          {checklistStats.total ? (
            <div className="checklist-progress">
              <div className="progress" aria-label={`Чеклист выполнен на ${checklistStats.percent}%`}>
                <span style={{ inlineSize: `${checklistStats.percent}%`, width: `${checklistStats.percent}%` }} />
              </div>
              <span className="muted">{checklistStats.percent}%</span>
            </div>
          ) : null}
          <div className="modal-checklist-list">
            {checklist?.items?.length ? (
              checklist.items.map((item: any) => (
                <div className="line-item checklist-line-item" key={item.id}>
                  <label className="checklist-toggle">
                    <input type="checkbox" defaultChecked={item.completed} onChange={(event) => props.onToggleChecklistItem(item.id, event.target.checked)} />
                    <span>{item.text}</span>
                  </label>
                  <button
                    className="button icon secondary checklist-delete"
                    type="button"
                    title="Удалить пункт"
                    aria-label={`Удалить пункт «${item.text}»`}
                    onClick={() => props.onDeleteChecklistItem(item.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            ) : (
              <p className="muted">Пунктов пока нет.</p>
            )}
          </div>
          <form className="modal-inline-form" action={props.onAddChecklistItem}>
            <input className="input" name="text" placeholder="Добавить пункт" required />
            <button className="button icon secondary" title="Добавить пункт">
              <Plus size={16} />
            </button>
          </form>
        </article>

        <article className="modal-mini-panel">
          <header>
            <span>
              <Paperclip size={15} />
              Файлы
            </span>
            <b>{props.task.fileAttachments.length}</b>
          </header>
          <form className="upload-placeholder" action={props.onUploadFile}>
            <input className="input" type="file" name="file" required />
            <button className="button secondary">
              <Paperclip size={16} />
              Прикрепить
            </button>
          </form>
          <div className="modal-files-list">
            {props.task.fileAttachments.map((file: any) => (
              <a className="file-pill" key={file.id} href={file.url} target="_blank">
                <Paperclip size={15} />
                <span>
                  <strong>{file.fileName}</strong>
                  <small>Добавил: {file.uploader?.name ?? "Неизвестно"}</small>
                </span>
              </a>
            ))}
          </div>
        </article>
          </section>
        </div>

      <aside className="modal-properties modal-properties-aside">
        <h3>Свойства</h3>
        <div className="property-grid">
          <label className="field modal-property-field">
            <span className="property-icon"><ListChecks size={19} /></span>
            <span className="label">Статус</span>
            <select className="select" defaultValue={props.task.columnId} disabled>
              {props.view.board.columns.map((column: any) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field modal-property-field">
            <span className="property-icon"><Flag size={19} /></span>
            <span className="label">Приоритет</span>
            <select className="select" form={editFormId} name="priority" defaultValue={props.task.priority}>
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field modal-property-field">
            <span className="property-icon"><Calendar size={19} /></span>
            <span className="label">Начало работы</span>
            <input className="input" form={editFormId} type="date" name="startDate" defaultValue={String(props.task.startDate ?? props.task.createdAt).slice(0, 10)} />
          </label>
          <label className="field modal-property-field">
            <span className="property-icon"><Calendar size={19} /></span>
            <span className="label">Дедлайн</span>
            <input className="input" form={editFormId} type="date" name="deadline" required defaultValue={props.task.deadline ? String(props.task.deadline).slice(0, 10) : ""} />
          </label>
          <ReminderFields personal={isPersonalBoard} formId={editFormId} defaultDays={props.task.reminderDaysBefore} />
          {!isPersonalBoard ? <label className="field modal-property-field">
            <span className="property-icon"><Building2 size={19} /></span>
            <span className="label">Нефтебаза</span>
            <select className="select" form={editFormId} name="oilDepotId" defaultValue={props.task.oilDepotId ?? ""}>
              <option value="">Без нефтебазы</option>
              {props.view.oilDepots.map((depot: any) => (
                <option key={depot.id} value={depot.id}>
                  {depot.name}
                  {depot.active ? "" : " (неактивна)"}
                </option>
              ))}
            </select>
          </label> : null}
          {!isPersonalBoard ? <AssigneePicker key={`assignees-${props.task.id}`} users={props.view.users} defaultIds={taskAssigneeUsers(props.task).map((user: any) => user.id)} formId={editFormId} /> : null}
        </div>
      </aside>
      </div>

      <footer className="task-modal-v2-actions">
        {props.error ? <p className="task-modal-error" role="alert">{props.error}</p> : null}
        <button className="button secondary" type="button" onClick={props.onClose}>
          Отмена
        </button>
        {props.canDelete ? (
          <button className="button secondary" type="button" title="Перенести задачу в архив" onClick={props.onArchive}>
            <Archive size={17} />
            В архив
          </button>
        ) : null}
        {props.canDelete ? (
          <button className="button danger" type="button" title="Удалить задачу навсегда" onClick={props.onDelete}>
            <Trash2 size={17} />
            Удалить
          </button>
        ) : null}
        <button className="button" form={editFormId}>
          <Save size={17} />
          Сохранить
        </button>
      </footer>
    </section>
  );
}

function taskPayload(formData: FormData) {
  const payload: any = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    columnId: String(formData.get("columnId") ?? ""),
    oilDepotId: String(formData.get("oilDepotId") ?? ""),
    priority: String(formData.get("priority") ?? "MEDIUM"),
    startDate: String(formData.get("startDate") ?? "") || null,
    deadline: String(formData.get("deadline") ?? "") || null,
    reminderDaysBefore: formData.get("reminderEnabled") === "on"
      ? Number(formData.get("reminderDaysBefore") ?? 1)
      : null,
    assigneeId: String(formData.get("assigneeId") ?? "") || null,
    assigneeIds: formData.getAll("assigneeIds").map((value) => String(value)).filter(Boolean),
    initialComment: String(formData.get("initialComment") ?? ""),
    initialChecklist: formData
      .getAll("initialChecklist")
      .map((item) => String(item).trim())
      .filter(Boolean),
  };

  if (formData.has("tags")) {
    payload.tags = String(formData.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return payload;
}

function ReminderFields({ personal, formId, defaultDays }: { personal: boolean; formId?: string; defaultDays?: number | null }) {
  const fieldId = useId();
  const [enabled, setEnabled] = useState(defaultDays != null);

  return (
    <div className="field modal-property-field reminder-property">
      <span className="property-icon"><Bell size={19} /></span>
      <span className="label">Напоминание</span>
      <label className="reminder-toggle" htmlFor={`${fieldId}-enabled`}>
        <input
          id={`${fieldId}-enabled`}
          form={formId}
          type="checkbox"
          name="reminderEnabled"
          checked={enabled}
          onChange={(event) => setEnabled(event.currentTarget.checked)}
        />
        <span>{personal ? "Напомнить мне в Telegram" : "Напомнить в общем канале"}</span>
      </label>
      {personal ? (
        <label className="reminder-offset" htmlFor={`${fieldId}-days`}>
          <span>Когда напомнить</span>
          <select id={`${fieldId}-days`} className="select" form={formId} name="reminderDaysBefore" defaultValue={String(defaultDays ?? 1)} disabled={!enabled}>
            <option value="0">В день дедлайна</option>
            <option value="1">За 1 день</option>
            <option value="2">За 2 дня</option>
            <option value="3">За 3 дня</option>
            <option value="7">За неделю</option>
          </select>
        </label>
      ) : (
        <>
          <input form={formId} type="hidden" name="reminderDaysBefore" value="1" />
          <small className="modal-property-help reminder-help">За 1 день до дедлайна, в 09:00</small>
        </>
      )}
    </div>
  );
}

function AssigneePicker({ users, defaultIds = [], formId }: { users: any[]; defaultIds?: string[]; formId?: string }) {
  const pickerId = useId();
  const labelId = `${pickerId}-label`;
  const [selectedIds, setSelectedIds] = useState(() => [...new Set(defaultIds)]);
  const [query, setQuery] = useState("");
  const selectedUsers = users.filter((user) => selectedIds.includes(user.id));
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const visibleUsers = normalizedQuery
    ? users.filter((user) => `${user.name} ${user.email}`.toLocaleLowerCase("ru-RU").includes(normalizedQuery))
    : users;
  const summary = selectedUsers.length
    ? `${selectedUsers.slice(0, 2).map((user) => user.name).join(", ")}${selectedUsers.length > 2 ? ` +${selectedUsers.length - 2}` : ""}`
    : "Выбрать исполнителей";

  function toggleAssignee(userId: string) {
    setSelectedIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  }

  return (
    <div className="field modal-property-field assignee-picker" role="group" aria-labelledby={labelId}>
      <span className="property-icon"><UserRound size={19} /></span>
      <span className="label" id={labelId}>Исполнители</span>
      {selectedIds.map((userId) => <input key={userId} type="hidden" form={formId} name="assigneeIds" value={userId} />)}
      <details className="assignee-select">
        <summary>
          <span className="assignee-summary-value">{summary}</span>
          <span className="assignee-summary-meta">
            {selectedIds.length ? <span className="assignee-picker-count" aria-label={`Выбрано: ${selectedIds.length}`}>{selectedIds.length}</span> : null}
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </summary>
        <div className="assignee-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Найти по имени" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
          {query ? <button type="button" aria-label="Очистить поиск" onClick={() => setQuery("")}><X size={15} aria-hidden="true" /></button> : null}
        </div>
        <div className="assignee-picker-list" role="listbox" aria-multiselectable="true">
          {visibleUsers.map((user) => {
            const selected = selectedIds.includes(user.id);
            const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]?.toLocaleUpperCase("ru-RU")).join("");
            return (
              <button className="assignee-option" type="button" role="option" aria-selected={selected} data-selected={selected || undefined} key={user.id} onClick={() => toggleAssignee(user.id)}>
                <span className="assignee-option-avatar" aria-hidden="true">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials || "?"}</span>
                <span className="assignee-option-copy">
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </span>
                <span className="assignee-option-check" aria-hidden="true">{selected ? <Check size={15} /> : null}</span>
              </button>
            );
          })}
          {!visibleUsers.length ? <p className="assignee-empty">Никого не найдено</p> : null}
        </div>
        {selectedUsers.length ? (
          <div className="assignee-picker-footer">
            <span>{assigneeCountLabel(selectedUsers.length)}</span>
            <button type="button" onClick={() => setSelectedIds([])}>Очистить</button>
          </div>
        ) : null}
      </details>
    </div>
  );
}

function assigneeCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} исполнитель`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} исполнителя`;
  return `${count} исполнителей`;
}

function taskAssigneeUsers(task: Task) {
  if (task.assignees?.length) return task.assignees.map((item: any) => item.user);
  return task.assignee ? [task.assignee] : [];
}

function readFiltersFromUrl() {
  if (typeof window === "undefined") return { ...emptyFilters };
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") ?? "",
    priority: params.get("priority") ?? "",
    assignee: params.get("assignee") ?? "",
    deadline: params.get("deadline") ?? "",
    oilDepot: params.get("oilDepot") ?? "",
  };
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

function isOverdue(task: Task) {
  return Boolean(task.deadline && new Date(task.deadline).getTime() < startOfToday().getTime() && !isCompletedColumn(task.column?.name ?? "") && !isReviewColumn(task.column?.name ?? ""));
}

function isDueToday(task: Task) {
  if (!task.deadline) return false;
  const deadline = new Date(task.deadline);
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  return deadline >= today && deadline < tomorrow;
}

function isDueSoon(task: Task) {
  if (!task.deadline || isOverdue(task) || isDueToday(task)) return false;
  const deadline = new Date(task.deadline).getTime();
  const soon = startOfToday().getTime() + 4 * 24 * 60 * 60 * 1000;
  return deadline <= soon;
}

function deadlineTone(task: Task) {
  if (isReviewColumn(task.column?.name ?? "")) return "deadline-review";
  if (isOverdue(task)) return "deadline-overdue";
  if (isDueToday(task)) return "deadline-today";
  if (isDueSoon(task)) return "deadline-soon";
  return "deadline-normal";
}

function deadlineText(task: Task) {
  if (!task.deadline) return "Без срока";
  if (isReviewColumn(task.column?.name ?? "")) return "На согласовании";
  if (isOverdue(task)) return `Просрочено · ${dateOnly(task.deadline)}`;
  if (isDueToday(task)) return "Сегодня";
  if (isDueSoon(task)) return `Скоро · ${dateOnly(task.deadline)}`;
  return dateOnly(task.deadline);
}

function reminderLabel(days: number) {
  if (days === 0) return "В день срока";
  if (days === 1) return "За 1 день";
  if (days >= 5) return `За ${days} дней`;
  return `За ${days} дня`;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function checklistProgress(task: Task) {
  const items = task.checklists.flatMap((checklist: any) => checklist.items);
  const total = items.length;
  const completed = items.filter((item: any) => item.completed).length;
  return { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 };
}

function dateOnly(value: string) {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value));
}

function timeOnly(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(value);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function activityLabel(action: string) {
  const labels: Record<string, string> = {
    TASK_CREATED: "Создание задачи",
    TITLE_CHANGED: "Название изменено",
    DESCRIPTION_CHANGED: "Описание изменено",
    STATUS_CHANGED: "Статус изменён",
    PRIORITY_CHANGED: "Приоритет изменён",
    START_DATE_CHANGED: "Дата начала изменена",
    DEADLINE_CHANGED: "Дедлайн изменён",
    ASSIGNEE_CHANGED: "Исполнитель изменён",
    COMMENT_ADDED: "Комментарий добавлен",
    FILE_UPLOADED: "Файл загружен",
    CHECKLIST_CHANGED: "Чек-лист изменён",
    TASK_DELETED: "Задача удалена",
    COLUMN_CHANGED: "Колонка изменена",
  };
  return labels[action] ?? action;
}
