"use client";

import { LayoutDashboard, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type PersonalBoard = { id: string; name: string; createdAt?: string; _count?: { columns: number } };

export function PersonalBoardSettings({ initialBoards }: { initialBoards: PersonalBoard[] }) {
  const [boards, setBoards] = useState(initialBoards);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<PersonalBoard | null>(null);

  async function createBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) return;
    setAdding(true);
    setError("");
    try {
      const response = await fetch("/api/personal-boards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Не удалось создать личную доску");
      setBoards((current) => [...current, data.board]);
      form.reset();
    } finally {
      setAdding(false);
    }
  }

  async function removeBoard(board: PersonalBoard) {
    setDeleting(null);
    setError("");
    const response = await fetch(`/api/personal-boards/${board.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? "Не удалось удалить личную доску");
    setBoards((current) => current.filter((item) => item.id !== board.id));
  }

  return (
    <section className="settings-block settings-manager personal-board-settings" aria-labelledby="personal-boards-title">
      <header className="settings-manager-head">
        <span className="settings-manager-icon"><LayoutDashboard size={20} /></span>
        <div>
          <h2 id="personal-boards-title">Личные доски</h2>
          <p>Эти доски и задачи видны только вам и не выводятся в TV-режиме.</p>
        </div>
        <span className="settings-summary-badge">{boards.length}</span>
      </header>

      <form className="settings-add-form" onSubmit={createBoard}>
        <label className="field">
          <span>Название доски</span>
          <input className="input" name="name" placeholder="Например, Личные задачи" minLength={2} maxLength={80} required />
        </label>
        <button className="button" disabled={adding}>
          <Plus size={18} />
          {adding ? "Создаём…" : "Создать доску"}
        </button>
      </form>

      {error ? <p className="settings-error" role="alert">{error}</p> : null}
      <div className="settings-list" aria-label="Личные доски">
        {boards.map((board) => (
          <article className="settings-row personal-board-row" key={board.id}>
            <span className="settings-manager-icon"><LayoutDashboard size={17} /></span>
            <div className="personal-board-copy">
              <strong>{board.name}</strong>
              <span>{board._count?.columns ?? 0} колонок · только вы</span>
            </div>
            <a className="button secondary compact-button" href={`/board?board=${board.id}`}>Открыть</a>
            <button className="button icon danger" type="button" onClick={() => setDeleting(board)} aria-label={`Удалить доску ${board.name}`}>
              <Trash2 size={17} />
            </button>
          </article>
        ))}
        {!boards.length ? <p className="settings-manager-note">У вас пока нет личных досок.</p> : null}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Удалить личную доску?"
        description={`Доска «${deleting?.name ?? ""}» и все её задачи будут удалены.`}
        confirmLabel="Удалить доску"
        tone="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && void removeBoard(deleting)}
      />
    </section>
  );
}
