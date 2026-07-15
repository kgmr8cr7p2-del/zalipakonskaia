"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { getNotificationSoundVolume, isNotificationSoundEnabled, playChatNotification, setNotificationSoundPreferences } from "@/lib/chat-notification";

export function NotificationSoundSettings() {
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    setEnabled(isNotificationSoundEnabled());
    setVolume(getNotificationSoundVolume());
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setNotificationSoundPreferences(next, volume);
  }

  function changeVolume(next: number) {
    setVolume(next);
    setNotificationSoundPreferences(enabled, next);
  }

  return (
    <section className="settings-sound-card" aria-labelledby="settings-sound-title">
      <div className="settings-sound-copy">
        <span className="settings-page-kicker"><Volume2 size={16} /> Звуки уведомлений</span>
        <h2 id="settings-sound-title">Звук включён на максимальной громкости</h2>
        <p className="muted">Звуки приходят для новых сообщений и упоминаний. После первого взаимодействия со страницей браузер сможет проигрывать их и в фоне.</p>
      </div>
      <div className="settings-sound-actions">
        <button className="button secondary" type="button" onClick={toggle} aria-pressed={enabled}>
          {enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          {enabled ? "Звуки включены" : "Звуки выключены"}
        </button>
        <label className="settings-volume-control">
          <span>Громкость: {Math.round(volume * 100)}%</span>
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => changeVolume(Number(event.currentTarget.value))} />
        </label>
        <button className="button ghost" type="button" onClick={() => void playChatNotification("mention")} disabled={!enabled}>Проверить звук</button>
      </div>
    </section>
  );
}
