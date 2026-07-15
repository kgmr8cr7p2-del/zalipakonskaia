"use client";

import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Notice = { id: string; type: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string };

export function NotificationCenter({ fullPage = false }: { fullPage?: boolean }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(fullPage);
  const [deleteTarget, setDeleteTarget] = useState<Notice | "all" | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function refresh() {
      const response = await fetch("/api/notifications?limit=40", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const payload = await response.json().catch(() => ({}));
      if (!active) return;
      const nextUnread = Number(payload.unreadCount) || 0;
      setUnread(nextUnread);
      setItems(Array.isArray(payload.notifications) ? payload.notifications : []);
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => undefined);
    setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    setUnread((current) => Math.max(0, current - 1));
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "read-all" }) }).catch(() => undefined);
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnread(0);
  }

  async function deleteNotifications() {
    const target = deleteTarget;
    if (!target) return;
    setError("");
    setDeleteTarget(null);
    const endpoint = target === "all" ? "/api/notifications" : `/api/notifications/${target.id}`;
    const response = await fetch(endpoint, { method: "DELETE" }).catch(() => null);
    const payload = await response?.json().catch(() => ({}));
    if (!response?.ok) {
      setError(payload?.error || "Не удалось удалить уведомления");
      return;
    }
    if (target === "all") {
      setItems([]);
      setUnread(0);
      return;
    }
    setItems((current) => current.filter((item) => item.id !== target.id));
    if (!target.readAt) setUnread((current) => Math.max(0, current - 1));
  }

  const content = <div className={fullPage ? "notification-page-card" : "notification-popover"}>
    <div className="notification-popover-head">
      <div><strong>Центр уведомлений</strong><small>{unread ? `${unread} непрочитанных` : "Всё прочитано"}</small></div>
      <div className="notification-popover-actions">
        {unread ? <button className="button ghost compact-button" type="button" onClick={() => void markAllRead()}><CheckCheck size={15} />Прочитать все</button> : null}
        {items.length ? <button className="button ghost compact-button danger-text" type="button" onClick={() => setDeleteTarget("all")}><Trash2 size={15} />Очистить все</button> : null}
      </div>
    </div>
    {error ? <p className="browser-push-message notification-error" role="status">{error}</p> : null}
    <div className="notification-list">
      {items.length ? items.map((item) => <article className={`notification-item ${item.readAt ? "" : "is-unread"}`} key={item.id}>
        <span className={`notification-dot notification-dot-${item.type.toLowerCase()}`} />
        <a className="notification-item-link" href={item.href || "#"} onClick={() => void markRead(item.id)}>
          <strong>{item.title}</strong><span>{item.body}</span><small>{new Date(item.createdAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}</small>
        </a>
        <button className="notification-delete-button" type="button" aria-label={`Удалить уведомление «${item.title}»`} title="Удалить уведомление" onClick={() => setDeleteTarget(item)}><Trash2 size={15} /></button>
      </article>) : <p className="muted notification-empty">Уведомлений пока нет.</p>}
    </div>
    {!fullPage ? <a className="notification-open-link" href="/notifications" onClick={() => setOpen(false)}>Открыть центр уведомлений</a> : null}
    <ConfirmDialog
      open={Boolean(deleteTarget)}
      title={deleteTarget === "all" ? "Очистить все уведомления?" : "Удалить уведомление?"}
      description={deleteTarget === "all" ? "Все уведомления будут удалены без возможности восстановления." : "Это уведомление будет удалено без возможности восстановления."}
      confirmLabel={deleteTarget === "all" ? "Очистить все" : "Удалить"}
      tone="danger"
      onCancel={() => setDeleteTarget(null)}
      onConfirm={() => void deleteNotifications()}
    />
  </div>;

  if (fullPage) return <main className="content notification-page"><div className="page-heading"><div><span className="eyebrow">Обратная связь</span><h1>Уведомления</h1><p className="muted">Упоминания, новые сообщения и важные события в ваших чатах.</p></div></div>{content}</main>;
  return <div className="notification-center"><button className="nav-notification-button" type="button" aria-label="Открыть центр уведомлений" aria-expanded={open} onClick={() => setOpen((current) => !current)}><Bell size={18} />{unread ? <span className="nav-unread-badge">{unread > 99 ? "99+" : unread}</span> : null}</button>{open ? content : null}</div>;
}
