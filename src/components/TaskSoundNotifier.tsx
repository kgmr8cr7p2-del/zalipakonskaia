"use client";

import { useEffect, useRef } from "react";
import { getNotificationSoundVolume, primeNotificationSound } from "@/lib/chat-notification";

const LAST_TASK_SOUND_EVENT_KEY = "team-kanban-last-task-sound-event";
const TASK_SOUND_LOCK_NAME = "team-kanban-task-sound-playback";
const EVENT_MAX_AGE_MS = 5 * 60 * 1000;

export function TaskSoundNotifier() {
  const playedEventsRef = useRef(new Set<string>());

  useEffect(() => {
    const checkTaskSound = async () => {
      try {
        const response = await fetch("/api/task-sound", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const event = data?.event;
        if (!event?.id || !event?.soundUrl || !event?.createdAt) return;

        const createdAt = new Date(event.createdAt).getTime();
        if (!Number.isFinite(createdAt) || Date.now() - createdAt > EVENT_MAX_AGE_MS) return;

        const key = String(event.id);
        if (playedEventsRef.current.has(key)) return;

        playedEventsRef.current.add(key);
        const claimed = await claimPlayback(key, createdAt);
        if (!claimed) return;
        await playOnce(String(event.soundUrl));
      } catch {
        // Sound notifications are best-effort; board updates keep working if audio polling fails.
      }
    };

    const unlockHandler = () => { void primeNotificationSound(); };

    void checkTaskSound();
    const timer = window.setInterval(() => void checkTaskSound(), 2000);
    window.addEventListener("pointerdown", unlockHandler, { once: true, passive: true });
    window.addEventListener("keydown", unlockHandler, { once: true });

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", unlockHandler);
      window.removeEventListener("keydown", unlockHandler);
    };
  }, []);

  return null;
}

async function claimPlayback(eventId: string, createdAt: number) {
  const claim = () => {
    const lastEvent = readLastPlayedEvent();
    if (lastEvent && lastEvent.createdAt >= createdAt) return false;
    window.localStorage.setItem(LAST_TASK_SOUND_EVENT_KEY, JSON.stringify({ id: eventId, createdAt }));
    return true;
  };

  if (navigator.locks) {
    return navigator.locks.request(TASK_SOUND_LOCK_NAME, claim);
  }
  return claim();
}

function readLastPlayedEvent(): { id: string; createdAt: number } | null {
  try {
    const value = window.localStorage.getItem(LAST_TASK_SOUND_EVENT_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    return typeof parsed?.id === "string" && Number.isFinite(parsed?.createdAt) ? parsed : null;
  } catch {
    return null;
  }
}

function playOnce(soundUrl: string) {
  return new Promise<void>((resolve) => {
    const audio = new Audio(soundUrl);
    audio.preload = "auto";
    audio.volume = getNotificationSoundVolume();
    audio.currentTime = 0;
    audio.addEventListener("ended", () => resolve(), { once: true });
    audio.addEventListener("error", () => resolve(), { once: true });
    void audio.play().catch(() => resolve());
  });
}
