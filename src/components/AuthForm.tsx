"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode, nextPath }: { mode: "login" | "register"; nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      const payload = Object.fromEntries(formData);
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Не удалось выполнить действие");
        return;
      }
      const safeNext = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/board";
      router.push(data.verified === false ? "/verify-email" : safeNext);
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form auth-form" action={submit} aria-busy={loading}>
      {mode === "register" ? (
        <div className="auth-name-grid">
          <div className="field auth-field">
            <label className="label" htmlFor="last-name">Фамилия</label>
            <span className="auth-control">
              <UserRound size={18} aria-hidden="true" />
              <input id="last-name" name="lastName" autoComplete="family-name" enterKeyHint="next" minLength={2} maxLength={80} required placeholder="Иванов" />
            </span>
          </div>
          <div className="field auth-field">
            <label className="label" htmlFor="first-name">Имя</label>
            <span className="auth-control">
              <UserRound size={18} aria-hidden="true" />
              <input id="first-name" name="firstName" autoComplete="given-name" enterKeyHint="next" minLength={2} maxLength={80} required placeholder="Иван" />
            </span>
          </div>
          <div className="field auth-field auth-name-middle">
            <label className="label" htmlFor="middle-name">Отчество <span className="optional-label">необязательно</span></label>
            <span className="auth-control">
              <UserRound size={18} aria-hidden="true" />
              <input id="middle-name" name="middleName" autoComplete="additional-name" enterKeyHint="next" maxLength={80} placeholder="Иванович" />
            </span>
          </div>
        </div>
      ) : null}
      <div className="field auth-field">
        <label className="label" htmlFor="email">Почта</label>
        <span className="auth-control">
          <Mail size={18} aria-hidden="true" />
          <input id="email" name="email" type="email" inputMode="email" autoComplete="username" enterKeyHint="next" required placeholder="name@company.ru" />
        </span>
      </div>
      <div className="field auth-field">
        <label className="label" htmlFor={mode === "login" ? "current-password" : "new-password"}>Пароль</label>
        <span className="auth-control auth-password-control">
          <LockKeyhole size={18} aria-hidden="true" />
          <input
            id={mode === "login" ? "current-password" : "new-password"}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            enterKeyHint="done"
            minLength={mode === "register" ? 8 : undefined}
            aria-describedby={mode === "register" ? "password-hint" : undefined}
            required
            placeholder={mode === "register" ? "Минимум 8 символов" : "Введите пароль"}
          />
          <button
            className="auth-password-toggle"
            type="button"
            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </span>
        {mode === "register" ? <small className="auth-field-hint" id="password-hint">Используйте не меньше 8 символов.</small> : null}
      </div>
      {error ? <p className="auth-error" role="alert"><AlertCircle size={17} aria-hidden="true" />{error}</p> : null}
      <button className="button auth-submit" disabled={loading}>
        <span>{loading ? "Подождите…" : mode === "login" ? "Войти в доску" : "Создать аккаунт"}</span>
        {!loading ? <ArrowRight size={18} aria-hidden="true" /> : <span className="auth-spinner" aria-hidden="true" />}
      </button>
      <p className="auth-switch">
        {mode === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
        <Link href={mode === "login" ? "/register" : "/login"}>{mode === "login" ? "Зарегистрироваться" : "Войти"}</Link>
      </p>
    </form>
  );
}
