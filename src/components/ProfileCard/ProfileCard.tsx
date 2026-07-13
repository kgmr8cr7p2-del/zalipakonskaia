"use client";

import { Mail, X } from "lucide-react";
import { type CSSProperties, type MouseEvent, type PointerEvent, useId, useRef, useState } from "react";
import { DirectChat } from "@/components/DirectChat";
import { presenceLabel } from "@/lib/presence";
import "./ProfileCard.css";

export type ProfileUser = {
  id: string;
  name: string;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  email: string;
  jobTitle?: string | null;
  handle?: string | null;
  profileStatus?: string | null;
  currentActivity?: string | null;
  lastActiveAt?: string | Date | null;
  avatarUrl?: string | null;
};

type ProfileCardProps = {
  name: string;
  title?: string;
  handle?: string;
  status?: string;
  contactText?: string;
  avatarUrl?: string | null;
  showUserInfo?: boolean;
  enableTilt?: boolean;
  enableMobileTilt?: boolean;
  onContactClick?: () => void;
  behindGlowColor?: string;
  iconUrl?: string;
  behindGlowEnabled?: boolean;
  innerGradient?: string;
};

type CardStyle = CSSProperties & Record<`--${string}`, string | number>;

export default function ProfileCard({
  name,
  title = "Участник команды",
  handle = "",
  status = "В сети",
  contactText = "Написать",
  avatarUrl,
  showUserInfo = true,
  enableTilt = true,
  enableMobileTilt = false,
  onContactClick,
  behindGlowColor = "rgba(67, 133, 255, 0.58)",
  iconUrl,
  behindGlowEnabled = true,
  innerGradient = "linear-gradient(145deg, rgba(17, 43, 87, .96) 0%, rgba(37, 99, 235, .48) 100%)",
}: ProfileCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const initials = profileInitials(name);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!enableTilt || (event.pointerType !== "mouse" && !enableMobileTilt)) return;
    const card = cardRef.current;
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = card.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    card.style.setProperty("--pointer-x", `${x * 100}%`);
    card.style.setProperty("--pointer-y", `${y * 100}%`);
    card.style.setProperty("--pointer-from-left", String(x));
    card.style.setProperty("--pointer-from-top", String(y));
    card.style.setProperty("--pointer-from-center", String(Math.min(1, Math.hypot(x - 0.5, y - 0.5) * 1.42)));
    card.style.setProperty("--background-x", `${35 + x * 30}%`);
    card.style.setProperty("--background-y", `${35 + y * 30}%`);
    card.style.setProperty("--rotate-x", `${(x - 0.5) * 16}deg`);
    card.style.setProperty("--rotate-y", `${(0.5 - y) * 16}deg`);
    setActive(true);
  }

  function reset() {
    const card = cardRef.current;
    if (card) {
      card.style.setProperty("--rotate-x", "0deg");
      card.style.setProperty("--rotate-y", "0deg");
    }
    setActive(false);
  }

  const style: CardStyle = {
    "--behind-glow-color": behindGlowColor,
    "--inner-gradient": innerGradient,
    "--icon": iconUrl ? `url("${iconUrl}")` : "none",
  };

  return (
    <div ref={cardRef} className={`pc-card-wrapper ${active ? "active" : ""}`} style={style} onPointerMove={move} onPointerLeave={reset}>
      {behindGlowEnabled ? <div className="pc-behind" aria-hidden="true" /> : null}
      <div className="pc-card-shell">
        <article className={`pc-card ${active ? "active" : ""}`}>
          <div className="pc-inside" aria-hidden="true" />
          <div className="pc-shine" aria-hidden="true" />
          <div className="pc-glare" aria-hidden="true" />
          <div className="pc-avatar-content" aria-hidden="true">
            {avatarUrl ? <img className="pc-avatar-image" src={avatarUrl} alt="" /> : <span className="pc-avatar-placeholder">{initials}</span>}
          </div>
          <div className="pc-content">
            <div className="pc-details">
              <h3>{name}</h3>
              <p>{title || "Участник команды"}</p>
            </div>
          </div>
          {showUserInfo ? (
            <div className="pc-user-info">
              <div className="pc-user-details">
                <ProfileAvatar name={name} avatarUrl={avatarUrl} size={44} />
                <div className="pc-user-text">
                  <span className="pc-handle">@{handle || fallbackHandle(name)}</span>
                  <span className={`pc-status ${status === "Не в сети" ? "offline" : status === "Отошёл" || status === "Неактивен" ? "away" : "online"}`}><i aria-hidden="true" />{status || "В сети"}</span>
                </div>
              </div>
              {onContactClick ? <button className="pc-contact-btn" type="button" onClick={onContactClick}><Mail size={14} />{contactText}</button> : null}
            </div>
          ) : null}
        </article>
      </div>
    </div>
  );
}

export function ProfileAvatar({ name, avatarUrl, size = 36 }: { name: string; avatarUrl?: string | null; size?: number }) {
  return (
    <span className="profile-avatar" style={{ "--profile-avatar-size": `${size}px` } as CardStyle} aria-hidden="true">
      {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{profileInitials(name)}</span>}
    </span>
  );
}

export function UserProfileButton({ user, viewerId, size = 32 }: { user: ProfileUser; viewerId?: string; size?: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [chatOpen, setChatOpen] = useState(false);

  function close() {
    dialogRef.current?.close();
    triggerRef.current?.focus();
  }

  function lightDismiss(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }

  return (
    <>
      <button ref={triggerRef} className="profile-avatar-button" type="button" aria-label={`Открыть профиль ${user.name}`} onClick={() => dialogRef.current?.showModal()}>
        <ProfileAvatar name={user.name} avatarUrl={user.avatarUrl} size={size} />
      </button>
      <dialog ref={dialogRef} className="profile-card-dialog" aria-labelledby={titleId} onClick={lightDismiss}>
        <h2 className="visually-hidden" id={titleId}>Профиль {user.name}</h2>
        <button className="profile-card-close" type="button" aria-label="Закрыть профиль" onClick={close}><X size={18} /></button>
        <ProfileCard
          name={user.name}
          title={user.jobTitle || "Участник команды"}
          handle={user.handle || fallbackHandle(user.name)}
          status={presenceLabel(user)}
          avatarUrl={user.avatarUrl}
          showUserInfo
          enableTilt
          onContactClick={viewerId && viewerId !== user.id ? () => {
            dialogRef.current?.close();
            setChatOpen(true);
          } : undefined}
        />
      </dialog>
      {chatOpen && viewerId ? <DirectChat user={user} viewerId={viewerId} onClose={() => { setChatOpen(false); triggerRef.current?.focus(); }} /> : null}
    </>
  );
}

function profileInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("ru-RU")).join("") || "?";
}

function fallbackHandle(name: string) {
  return name.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]+/gu, ".").replace(/^\.|\.$/g, "") || "user";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
