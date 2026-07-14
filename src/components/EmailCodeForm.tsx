"use client";

import { AlertCircle, ArrowRight, KeyRound, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function EmailCodeForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  if (!email) {
    return (
      <div className="auth-empty-step">
        <p>Не указана почта для подтверждения.</p>
        <Link className="button" href="/register">Вернуться к регистрации</Link>
      </div>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Не удалось подтвердить почту");
        return;
      }
      router.push(data.approved === false ? "/pending-approval" : "/board");
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Не удалось отправить новый код");
        return;
      }
      setStatus("Новый код отправлен. Проверьте входящие и папку «Спам».");
    } catch {
      setError("Не удалось связаться с сервером. Попробуйте ещё раз.");
    } finally {
      setResending(false);
    }
  }

  const errorId = error ? "verification-code-error" : undefined;
  return (
    <form className="form auth-form auth-step-form" onSubmit={submit} aria-busy={loading}>
      <p className="auth-delivery-note">Код отправлен на <strong>{email}</strong></p>
      <div className="field auth-field">
        <label className="label" htmlFor="verification-code">Код из письма</label>
        <span className="auth-control">
          <KeyRound size={18} aria-hidden="true" />
          <input
            className="auth-code-input"
            id="verification-code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            enterKeyHint="done"
            pattern="\d{6}"
            minLength={6}
            maxLength={6}
            aria-invalid={Boolean(error)}
            aria-describedby={["verification-code-hint", errorId].filter(Boolean).join(" ")}
            placeholder="000000"
            autoFocus
            required
          />
        </span>
        <small className="auth-field-hint" id="verification-code-hint">Шесть цифр, код действует 10 минут.</small>
      </div>
      {error ? <p className="auth-error" id="verification-code-error" role="alert"><AlertCircle size={17} aria-hidden="true" />{error}</p> : null}
      {status ? <p className="auth-success" role="status">{status}</p> : null}
      <button className="button auth-submit" disabled={loading || code.length !== 6}>
        <span>{loading ? "Проверяем…" : "Подтвердить и войти"}</span>
        {!loading ? <ArrowRight size={18} aria-hidden="true" /> : <span className="auth-spinner" aria-hidden="true" />}
      </button>
      <div className="auth-secondary-actions">
        <button className="auth-text-button" type="button" disabled={resending} onClick={() => void resend()}>
          <RotateCw size={15} aria-hidden="true" />{resending ? "Отправляем…" : "Отправить код ещё раз"}
        </button>
        <Link href="/register">Изменить почту</Link>
      </div>
    </form>
  );
}
