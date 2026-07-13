"use client";

import { MessageCircle, Paperclip, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatThread } from "@/components/DirectChat";
import type { ProfileUser } from "@/components/ProfileCard/ProfileCard";
import { presenceLabel, presenceTone } from "@/lib/presence";

type Conversation = {
  user: ProfileUser;
  unreadCount: number;
  latest: {
    id: string;
    text: string;
    senderId: string;
    recipientId: string;
    fileName?: string | null;
    readAt?: string | null;
    createdAt: string;
  } | null;
};

export function ChatHub({ viewerId }: { viewerId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/messages/conversations", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Не удалось загрузить чаты");
    else {
      setConversations(payload.conversations ?? []);
      setError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const visibleConversations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    if (!normalized) return conversations;
    return conversations.filter(({ user }) => [user.name, user.email, user.jobTitle, user.handle].some((value) => value?.toLocaleLowerCase("ru-RU").includes(normalized)));
  }, [conversations, query]);

  const selected = conversations.find(({ user }) => user.id === selectedId) ?? null;

  function chooseConversation(id: string) {
    setSelectedId(id);
    setConversations((current) => current.map((item) => (item.user.id === id ? { ...item, unreadCount: 0 } : item)));
  }

  return (
    <section className={`chat-hub ${selected ? "has-selection" : ""}`} aria-label="Чаты команды">
      <aside className="chat-directory" aria-label="Список чатов">
        <div className="chat-directory-head">
          <div>
            <h2>Диалоги</h2>
            <span>{conversations.length} {conversationWord(conversations.length)}</span>
          </div>
          <label className="chat-search">
            <Search size={17} aria-hidden="true" />
            <span className="visually-hidden">Найти человека</span>
            <input type="search" placeholder="Найти по имени или почте" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
          </label>
        </div>

        <ul className="chat-directory-list" aria-busy={loading}>
          {loading ? <li className="chat-directory-empty">Загружаем коллег…</li> : null}
          {!loading && !visibleConversations.length ? <li className="chat-directory-empty">По этому запросу никого не найдено.</li> : null}
          {visibleConversations.map((conversation) => {
            const status = presenceLabel(conversation.user);
            const initials = conversation.user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("ru-RU")).join("");
            return (
              <li key={conversation.user.id}>
                <button
                  className={`chat-directory-item ${selectedId === conversation.user.id ? "is-active" : ""}`}
                  type="button"
                  onClick={() => chooseConversation(conversation.user.id)}
                >
                  <span className="direct-chat-avatar" aria-hidden="true">
                    {conversation.user.avatarUrl ? <img src={conversation.user.avatarUrl} alt="" /> : initials || "?"}
                    <i className={`chat-avatar-presence ${presenceTone(conversation.user)}`} />
                  </span>
                  <span className="chat-directory-copy">
                    <span className="chat-directory-name"><strong>{conversation.user.name}</strong>{conversation.latest ? <time dateTime={conversation.latest.createdAt}>{formatListTime(conversation.latest.createdAt)}</time> : null}</span>
                    <span className="chat-directory-preview">
                      {conversation.latest?.fileName && !conversation.latest.text ? <><Paperclip size={13} /> {conversation.latest.fileName}</> : conversation.latest?.text || status}
                    </span>
                  </span>
                  {conversation.unreadCount ? <span className="chat-unread-count" aria-label={`Непрочитанных сообщений: ${conversation.unreadCount}`}>{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {error ? <p className="chat-directory-error" role="alert">{error}</p> : null}
      </aside>

      <div className="chat-workspace">
        {selected ? (
          <ChatThread
            embedded
            user={selected.user}
            viewerId={viewerId}
            onBack={() => setSelectedId(null)}
            onMessagesRead={refresh}
          />
        ) : (
          <div className="chat-welcome">
            <span><MessageCircle size={28} aria-hidden="true" /></span>
            <h2>Выберите диалог</h2>
            <p>Найдите коллегу слева — можно писать сообщения и отправлять файлы до 15 МБ.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function formatListTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(date);
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(date);
}

function conversationWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "диалог";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "диалога";
  return "диалогов";
}
