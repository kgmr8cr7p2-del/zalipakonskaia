"use client";

import { ArrowLeft, CheckCheck, FileText, Paperclip, Send, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ProfileUser } from "@/components/ProfileCard/ProfileCard";
import { presenceLabel, presenceTone, setPresenceActivity } from "@/lib/presence";

export type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  recipientId: string;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type ChatThreadProps = {
  user: ProfileUser;
  viewerId: string;
  onClose?: () => void;
  onBack?: () => void;
  onMessagesRead?: () => void;
  embedded?: boolean;
};

export function ChatThread({ user, viewerId, onClose, onBack, onMessagesRead, embedded = false }: ChatThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPresenceActivity(`Общается с ${user.name}`);
    return () => setPresenceActivity(null);
  }, [user.id, user.name]);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const response = await fetch(`/api/messages?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!active) return;
      if (!response.ok) setError(payload.error || "Не удалось загрузить сообщения");
      else {
        setMessages(payload.messages ?? []);
        onMessagesRead?.();
      }
      setLoading(false);
    }
    setLoading(true);
    setMessages([]);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user.id, onMessagesRead]);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (!onClose) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    body.set("userId", user.id);
    if (!String(body.get("text") ?? "").trim() && !(body.get("file") instanceof File && (body.get("file") as File).size)) return;
    setSending(true);
    setError("");
    const response = await fetch("/api/messages", { method: "POST", body });
    const payload = await response.json().catch(() => ({}));
    setSending(false);
    if (!response.ok) {
      setError(payload.error || "Не удалось отправить сообщение");
      return;
    }
    setMessages((current) => [...current, payload.message]);
    form.reset();
    setSelectedFile("");
  }

  const status = presenceLabel(user);
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("ru-RU")).join("");

  return (
    <section className={`direct-chat-panel ${embedded ? "is-embedded" : ""}`}>
      <header className="direct-chat-head">
        {onBack ? <button className="button icon secondary chat-back-button" type="button" aria-label="Вернуться к списку чатов" onClick={onBack}><ArrowLeft size={18} /></button> : null}
        <span className="direct-chat-avatar" aria-hidden="true">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials || "?"}
        </span>
        <div className="direct-chat-person">
          <h2 id={embedded ? "chat-thread-title" : "direct-chat-title"}>{user.name}</h2>
          <span className={`direct-chat-presence ${presenceTone(user)}`}><i aria-hidden="true" />{status}</span>
        </div>
        {onClose ? <button className="button icon secondary" type="button" aria-label="Закрыть чат" onClick={onClose}><X size={18} /></button> : null}
      </header>

      <div className="direct-chat-messages" ref={listRef} aria-live="polite" aria-busy={loading}>
        {loading ? <p className="direct-chat-empty">Загружаем переписку…</p> : null}
        {!loading && !messages.length ? <p className="direct-chat-empty">Начните диалог — сообщения видны только вам двоим.</p> : null}
        {messages.map((message) => {
          const own = message.senderId === viewerId;
          return (
            <article className={`direct-chat-message ${own ? "own" : ""}`} key={message.id}>
              {message.text ? <p>{message.text}</p> : null}
              {message.fileName ? (
                <a className="direct-chat-file" href={`/api/message-files/${message.id}`}>
                  <FileText size={17} />
                  <span><strong>{message.fileName}</strong><small>{formatFileSize(message.fileSize)}</small></span>
                </a>
              ) : null}
              <footer>
                <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                {own ? <span className={message.readAt ? "read" : ""}><CheckCheck size={14} />{message.readAt ? "Прочитано" : "Доставлено"}</span> : null}
              </footer>
            </article>
          );
        })}
      </div>

      <form className="direct-chat-compose" onSubmit={sendMessage}>
        <label className="button icon secondary direct-chat-attach" title="Прикрепить файл">
          <Paperclip size={18} />
          <span className="visually-hidden">Прикрепить файл до 15 МБ</span>
          <input type="file" name="file" onChange={(event) => setSelectedFile(event.currentTarget.files?.[0]?.name ?? "")} />
        </label>
        <textarea className="textarea" name="text" placeholder="Напишите сообщение…" maxLength={4000} rows={2} />
        <button className="button icon" disabled={sending} aria-label="Отправить сообщение"><Send size={18} /></button>
      </form>
      {selectedFile || error ? <p className="direct-chat-notice" role="status">{selectedFile ? `Прикреплён: ${selectedFile}` : error}</p> : null}
    </section>
  );
}

export function DirectChat({ user, viewerId, onClose }: { user: ProfileUser; viewerId: string; onClose: () => void }) {
  return createPortal(
    <aside className="direct-chat-backdrop" role="dialog" aria-modal="true" aria-labelledby="direct-chat-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <ChatThread user={user} viewerId={viewerId} onClose={onClose} />
    </aside>,
    document.body,
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatFileSize(size?: number | null) {
  if (!size) return "Файл";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} КБ`;
  return `${(size / 1024 / 1024).toFixed(1)} МБ`;
}
