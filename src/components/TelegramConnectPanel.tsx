"use client";

import { Check, Copy, ExternalLink, LoaderCircle, MessageCircle } from "lucide-react";
import { useState } from "react";

export function TelegramConnectPanel({ connected, botLink }: { connected: boolean; botLink: string | null }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function createCode() {
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const response = await fetch("/api/telegram/connect-code", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.code) throw new Error(payload.error || "Не удалось получить код подключения");
      setCode(`/connect ${payload.code}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось получить код подключения");
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setError("Не удалось скопировать команду. Выделите и скопируйте её вручную.");
    }
  }

  return (
    <section className="settings-block telegram-settings-panel" aria-labelledby="telegram-connect-title">
      <div className="telegram-settings-icon"><MessageCircle size={22} aria-hidden="true" /></div>
      <div className="telegram-settings-content">
        <div className="telegram-settings-heading">
          <div>
            <h2 id="telegram-connect-title">Чат с Telegram-ботом</h2>
            <p className="muted">Подключите личный чат, чтобы получать напоминания с личных досок.</p>
          </div>
          <span className={connected ? "telegram-status is-connected" : "telegram-status"}>
            {connected ? "Подключён" : "Не подключён"}
          </span>
        </div>

        <ol className="telegram-connect-steps">
          <li>Нажмите «Получить код подключения».</li>
          <li>Откройте бота и отправьте ему полученную команду.</li>
          <li>Бот подтвердит подключение. Код действует 15 минут и только один раз.</li>
        </ol>

        {code ? (
          <div className="telegram-connect-code-row">
            <code>{code}</code>
            <button className="button secondary" type="button" onClick={copyCode}>
              {copied ? <Check size={17} /> : <Copy size={17} />}
              {copied ? "Скопировано" : "Скопировать"}
            </button>
          </div>
        ) : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <div className="telegram-connect-actions">
          <button className="button" type="button" disabled={loading} onClick={createCode}>
            {loading ? <LoaderCircle className="spin" size={17} /> : null}
            {loading ? "Создаём код…" : "Получить код подключения"}
          </button>
          {botLink ? (
            <a className="button secondary" href={botLink} target="_blank" rel="noreferrer">
              Открыть бота <ExternalLink size={16} />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
