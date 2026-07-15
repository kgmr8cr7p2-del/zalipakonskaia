"use client";

import { BellRing, BellOff, CheckCircle2, Send } from "lucide-react";
import { useEffect, useState } from "react";

type PushState = "checking" | "unsupported" | "blocked" | "disabled" | "enabled";

export function BrowserPushSettings() {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function inspect() {
      if (!supportsPush()) {
        if (active) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setState("blocked");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
      const subscription = await registration?.pushManager.getSubscription().catch(() => null);
      if (active) setState(subscription ? "enabled" : "disabled");
    }
    void inspect();
    return () => { active = false; };
  }, []);

  async function enablePush() {
    setBusy(true);
    setMessage("");
    try {
      if (!supportsPush()) {
        setState("unsupported");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "disabled");
        setMessage("Разрешение не выдано. Push-уведомления не включены.");
        return;
      }
      const keyResponse = await fetch("/api/push-subscriptions", { cache: "no-store" });
      const keyPayload = await keyResponse.json().catch(() => ({}));
      if (!keyResponse.ok || !keyPayload.publicKey) throw new Error(keyPayload.error || "Не удалось получить ключ уведомлений");

      const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(String(keyPayload.publicKey)),
      });
      const serialized = subscription.toJSON();
      if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) throw new Error("Браузер не вернул данные подписки");
      const saveResponse = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: serialized.endpoint, keys: serialized.keys }),
      });
      const savePayload = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) throw new Error(savePayload.error || "Не удалось сохранить подписку");
      setState("enabled");
      try {
        await requestTestPush();
        setMessage("Push-уведомления включены. Тестовое уведомление отправлено в Windows.");
      } catch (error) {
        setMessage(`Push-уведомления включены, но тест не отправлен: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось включить push-уведомления");
    } finally {
      setBusy(false);
    }
  }

  async function testPush() {
    setBusy(true);
    setMessage("");
    try {
      await requestTestPush();
      setMessage("Тестовое уведомление отправлено. Если оно не появилось, проверьте уведомления Chrome и режим «Не беспокоить» в Windows.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось отправить тестовое уведомление");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push-subscriptions", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("Не удалось удалить подписку на сервере");
        await subscription.unsubscribe();
      }
      setState("disabled");
      setMessage("Push-уведомления выключены в этом браузере.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось выключить push-уведомления");
    } finally {
      setBusy(false);
    }
  }

  const description = state === "enabled"
    ? "Браузер покажет новые сообщения и упоминания, даже когда Taskora находится в фоне."
    : state === "blocked"
      ? "Уведомления заблокированы в настройках сайта. Разрешите их в адресной строке браузера и обновите страницу."
      : state === "unsupported"
        ? "Этот браузер не поддерживает Web Push или страница открыта без HTTPS."
        : "Разрешите браузеру показывать системные уведомления о новых сообщениях и упоминаниях.";

  return (
    <div className="settings-block browser-push-card">
      <span className={`browser-push-icon ${state === "enabled" ? "is-enabled" : ""}`} aria-hidden="true">
        {state === "enabled" ? <CheckCircle2 size={24} /> : <BellRing size={24} />}
      </span>
      <div>
        <h2>Push-уведомления браузера</h2>
        <p className="muted">{description}</p>
        {message ? <p className="browser-push-message" role="status">{message}</p> : null}
      </div>
      <div className="browser-push-actions">
        {state === "enabled"
          ? <><button className="button secondary" type="button" disabled={busy} onClick={() => void testPush()}><Send size={17} />Проверить</button><button className="button secondary" type="button" disabled={busy} onClick={() => void disablePush()}><BellOff size={17} />Выключить</button></>
          : <button className="button" type="button" disabled={busy || state === "unsupported" || state === "blocked" || state === "checking"} onClick={() => void enablePush()}><BellRing size={17} />{busy ? "Подключаем…" : "Включить push"}</button>}
      </div>
    </div>
  );
}

async function requestTestPush() {
  const response = await fetch("/api/push-subscriptions/test", { method: "POST" }).catch(() => null);
  const payload = await response?.json().catch(() => ({}));
  if (!response?.ok) throw new Error(payload?.error || "Не удалось отправить тестовое уведомление");
}

function supportsPush() {
  return typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}
