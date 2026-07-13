"use client";

import { ImagePlus, Save, Trash2 } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProfileCard, { type ProfileUser, ProfileAvatar } from "@/components/ProfileCard/ProfileCard";
import { presenceLabel } from "@/lib/presence";
import { formatUserName } from "@/lib/user-name";

const TELEGRAM_INVITE_URL = "https://t.me/+V1kH1F871nc5MTUy";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

type Crop = { zoom: number; x: number; y: number };

export function ProfileForm({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const [draft, setDraft] = useState({
    lastName: user.lastName ?? "",
    firstName: user.firstName || user.name,
    middleName: user.middleName ?? "",
    jobTitle: user.jobTitle ?? "",
    handle: user.handle ?? "",
  });
  const displayName = formatUserName(draft) || user.name;
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState(user.avatarUrl ?? "");
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 50, y: 50 });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [liveStatus, setLiveStatus] = useState(() => presenceLabel(user));

  useEffect(() => {
    const update = (event: Event) => setLiveStatus((event as CustomEvent<string>).detail || "В сети");
    window.addEventListener("presencechange", update);
    return () => window.removeEventListener("presencechange", update);
  }, []);

  useEffect(() => {
    if (!avatarFile) {
      setSourceUrl("");
      sourceImageRef.current = null;
      setPreviewUrl(avatarUrl);
      return;
    }
    const objectUrl = URL.createObjectURL(avatarFile);
    setSourceUrl(objectUrl);
    const image = new Image();
    image.onload = () => {
      sourceImageRef.current = image;
      renderCropPreview(image, cropCanvasRef.current, crop, setPreviewUrl);
    };
    image.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile, avatarUrl]);

  useEffect(() => {
    if (sourceImageRef.current) renderCropPreview(sourceImageRef.current, cropCanvasRef.current, crop, setPreviewUrl);
  }, [crop]);

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_AVATAR_SIZE) {
      setStatus("error");
      setMessage("Выберите изображение JPG, PNG, WebP или GIF размером до 5 МБ.");
      event.target.value = "";
      return;
    }
    setAvatarFile(file);
    setCrop({ zoom: 1, x: 50, y: 50 });
    setStatus("idle");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      let nextAvatarUrl = avatarUrl;
      if (avatarFile && sourceImageRef.current) {
        const croppedFile = await createCroppedAvatar(sourceImageRef.current, crop);
        const body = new FormData();
        body.set("avatar", croppedFile);
        const avatarResponse = await fetch("/api/profile/avatar", { method: "POST", body });
        const avatarPayload = await avatarResponse.json().catch(() => ({}));
        if (!avatarResponse.ok) throw new Error(avatarPayload.error || "Не удалось загрузить аватар.");
        nextAvatarUrl = avatarPayload.avatarUrl;
      }

      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Не удалось сохранить профиль.");

      setAvatarUrl(nextAvatarUrl);
      setAvatarFile(null);
      setStatus("saved");
      setMessage("Профиль сохранён");
      window.dispatchEvent(new CustomEvent("profileupdated", { detail: { ...draft, name: displayName, avatarUrl: nextAvatarUrl } }));
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить профиль.");
    }
  }

  async function removeAvatar() {
    if (avatarFile) {
      setAvatarFile(null);
      if (avatarUrl) return;
    }
    setStatus("saving");
    const response = await fetch("/api/profile/avatar", { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(payload.error || "Не удалось удалить аватар.");
      return;
    }
    setAvatarFile(null);
    setAvatarUrl("");
    setPreviewUrl("");
    setStatus("saved");
    setMessage("Аватар удалён");
    window.dispatchEvent(new CustomEvent("profileupdated", { detail: { ...draft, name: displayName, avatarUrl: "" } }));
    router.refresh();
  }

  return (
    <div className="profile-editor-layout">
      <form className="profile-editor-form" onSubmit={submit}>
        <section className="profile-avatar-editor" aria-labelledby="profile-photo-title">
          <ProfileAvatar name={displayName} avatarUrl={previewUrl} size={72} />
          <div>
            <h2 id="profile-photo-title">Фото профиля</h2>
            <p className="muted">JPG, PNG, WebP или GIF до 5 МБ.</p>
            <div className="toolbar">
              <label className="button secondary profile-avatar-upload">
                <ImagePlus size={17} aria-hidden="true" />
                Выбрать фото
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseAvatar} />
              </label>
              {previewUrl ? (
                <button className="button secondary" type="button" onClick={removeAvatar} disabled={status === "saving"}>
                  <Trash2 size={16} aria-hidden="true" /> Удалить
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {avatarFile ? (
          <fieldset className="avatar-cropper">
            <legend>Настройте кадр</legend>
            <div className="avatar-cropper-layout">
              <div className="avatar-crop-canvas-wrap"><canvas ref={cropCanvasRef} width={240} height={240} aria-label="Итоговый вид фотографии" /></div>
              <div className="avatar-crop-controls">
                <label><span>Масштаб</span><input type="range" min="1" max="3" step="0.05" value={crop.zoom} onChange={(event) => setCrop({ ...crop, zoom: Number(event.currentTarget.value) })} /></label>
                <label><span>По горизонтали</span><input type="range" min="0" max="100" value={crop.x} onChange={(event) => setCrop({ ...crop, x: Number(event.currentTarget.value) })} /></label>
                <label><span>По вертикали</span><input type="range" min="0" max="100" value={crop.y} onChange={(event) => setCrop({ ...crop, y: Number(event.currentTarget.value) })} /></label>
                <button className="button secondary" type="button" onClick={() => setCrop({ zoom: 1, x: 50, y: 50 })}>Сбросить кадр</button>
                <small>Слева показано ровно то, как фото будет обрезано после сохранения.</small>
              </div>
            </div>
          </fieldset>
        ) : null}

        <div className="profile-fields-grid">
          <label className="field">
            <span className="label">Фамилия</span>
            <input className="input" name="lastName" autoComplete="family-name" value={draft.lastName} minLength={2} maxLength={80} required onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} />
          </label>
          <label className="field">
            <span className="label">Имя</span>
            <input className="input" name="firstName" autoComplete="given-name" value={draft.firstName} minLength={2} maxLength={80} required onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} />
          </label>
          <label className="field">
            <span className="label">Отчество <span className="optional-label">необязательно</span></span>
            <input className="input" name="middleName" autoComplete="additional-name" value={draft.middleName} maxLength={80} onChange={(event) => setDraft({ ...draft, middleName: event.target.value })} />
          </label>
          <label className="field">
            <span className="label">Рабочая почта</span>
            <input className="input" type="email" value={user.email} readOnly />
          </label>
          <label className="field">
            <span className="label">Должность</span>
            <input className="input" name="jobTitle" value={draft.jobTitle} maxLength={100} placeholder="Например, инженер" onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })} />
          </label>
          <label className="field">
            <span className="label">Ник</span>
            <span className="profile-handle-input"><span aria-hidden="true">@</span><input className="input" name="handle" value={draft.handle} maxLength={40} pattern="[A-Za-zА-Яа-яЁё0-9._-]*" placeholder="username" onChange={(event) => setDraft({ ...draft, handle: event.target.value })} /></span>
          </label>
        </div>

        <p className="profile-auto-status"><i aria-hidden="true" />Статус меняется автоматически: сейчас — <strong>{liveStatus}</strong>.</p>
        <div className="profile-form-footer">
          <a className="button secondary profile-chat-link" href={TELEGRAM_INVITE_URL} target="_blank" rel="noreferrer">Рабочий Telegram-чат</a>
          <button className="button" disabled={status === "saving"}>
            <Save size={17} aria-hidden="true" /> {status === "saving" ? "Сохраняем…" : "Сохранить профиль"}
          </button>
        </div>
        {message ? <p className={`profile-form-message ${status === "error" ? "is-error" : ""}`} role="status">{message}</p> : null}
      </form>

      <aside className="profile-preview" aria-label="Предпросмотр карточки профиля">
        <span className="profile-preview-label">Так вас увидят коллеги</span>
        <ProfileCard name={displayName || "Ваше имя"} title={draft.jobTitle || "Участник команды"} handle={draft.handle} status={liveStatus} avatarUrl={previewUrl} showUserInfo enableTilt />
      </aside>
    </div>
  );
}

function drawCroppedImage(image: HTMLImageElement, canvas: HTMLCanvasElement, crop: Crop) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const size = canvas.width;
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * crop.zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = -(width - size) * (crop.x / 100);
  const y = -(height - size) * (crop.y / 100);
  context.clearRect(0, 0, size, size);
  context.drawImage(image, x, y, width, height);
}

function renderCropPreview(image: HTMLImageElement, canvas: HTMLCanvasElement | null, crop: Crop, setPreview: (value: string) => void) {
  if (!canvas) return;
  drawCroppedImage(image, canvas, crop);
  setPreview(canvas.toDataURL("image/webp", 0.88));
}

async function createCroppedAvatar(image: HTMLImageElement, crop: Crop) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  drawCroppedImage(image, canvas, crop);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Не удалось обработать фото")), "image/webp", 0.9));
  return new File([blob], "avatar.webp", { type: "image/webp" });
}
