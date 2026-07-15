let audioContext: AudioContext | null = null;
const SOUND_KEY = "taskora-notification-sound";
const VOLUME_KEY = "taskora-notification-volume-v2";

export function isNotificationSoundEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SOUND_KEY) !== "off";
}

export function getNotificationSoundVolume() {
  if (typeof window === "undefined") return 1;
  const value = Number(window.localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 1;
}

export function setNotificationSoundPreferences(enabled: boolean, volume: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
  window.localStorage.setItem(VOLUME_KEY, String(Math.min(1, Math.max(0, volume))));
}

export async function primeNotificationSound() {
  if (typeof window === "undefined" || !isNotificationSoundEnabled()) return;
  audioContext ??= new AudioContext();
  if (audioContext.state === "suspended") await audioContext.resume();
}

export async function playChatNotification(kind: "chat" | "mention" = "chat") {
  if (typeof window === "undefined") return;
  if (!isNotificationSoundEnabled()) return;
  try {
    await primeNotificationSound();
    if (!audioContext) return;
    const start = audioContext.currentTime;
    const volume = getNotificationSoundVolume();
    const first = kind === "mention" ? 880 : 660;
    const second = kind === "mention" ? 1046 : 880;
    playTone(audioContext, first, start, 0.08, volume);
    playTone(audioContext, second, start + 0.1, 0.1, volume * 0.8);
  } catch {
    // Browsers may block audio until the user has interacted with the page.
  }
}

function playTone(context: AudioContext, frequency: number, start: number, duration: number, volume: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}
