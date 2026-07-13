export type PresenceSource = {
  currentActivity?: string | null;
  lastActiveAt?: string | Date | null;
};

const ONLINE_WINDOW_MS = 70_000;
export const PRESENCE_ACTIVITY_EVENT = "presenceactivity";

export function setPresenceActivity(activity?: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PRESENCE_ACTIVITY_EVENT, { detail: activity?.trim() || null }));
}

export function presenceLabel(user: PresenceSource, now = Date.now()) {
  const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
  if (!lastActive || Number.isNaN(lastActive) || now - lastActive > ONLINE_WINDOW_MS) return "Не в сети";
  return user.currentActivity?.trim() || "В сети";
}

export function presenceTone(user: PresenceSource, now = Date.now()) {
  const label = presenceLabel(user, now);
  if (label === "Не в сети") return "offline";
  if (label === "Отошёл" || label === "Неактивен") return "away";
  return "online";
}
