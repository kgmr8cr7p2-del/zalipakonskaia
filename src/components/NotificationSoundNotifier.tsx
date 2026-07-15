"use client";

import { useEffect } from "react";
import { playChatNotification, primeNotificationSound } from "@/lib/chat-notification";

export function NotificationSoundNotifier() {
  useEffect(() => {
    let active = true;
    let previousUnread: number | null = null;

    async function check() {
      const response = await fetch("/api/notifications?limit=1", { cache: "no-store" }).catch(() => null);
      if (!active || !response?.ok) return;
      const payload = await response.json().catch(() => ({}));
      const nextUnread = Number(payload.unreadCount) || 0;
      if (previousUnread !== null && nextUnread > previousUnread) {
        const latest = payload.notifications?.[0];
        void playChatNotification(latest?.type === "MENTION" ? "mention" : "chat");
      }
      previousUnread = nextUnread;
    }

    const unlock = () => { void primeNotificationSound(); };
    void check();
    const timer = window.setInterval(() => void check(), 5000);
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return null;
}
