"use client";

import Link from "next/link";
import { Archive, BarChart3, Files, History, LayoutDashboard, MessageCircle, Moon, MoreHorizontal, ScrollText, Settings, Shield, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { ProfileAvatar } from "@/components/ProfileCard/ProfileCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { CurrentUser } from "@/lib/auth";

const links = [
  { href: "/board", label: "Доска", icon: LayoutDashboard, permission: "VIEW_BOARD" },
  { href: "/chats", label: "Чаты", icon: MessageCircle, permission: "USE_CHATS" },
  { href: "/files", label: "Документы", icon: Files },
  { href: "/reports", label: "Отчёты", icon: BarChart3, permission: "VIEW_REPORTS" },
  { href: "/history", label: "История", icon: History, permission: "VIEW_HISTORY" },
  { href: "/changelog", label: "Что нового", icon: ScrollText },
  { href: "/archive", label: "Архив", icon: Archive, permission: "VIEW_BOARD" },
  { href: "/profile", label: "Профиль", icon: UserRound },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function AppNav({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const hasAccess = Boolean(user.approvedAt);
  const hasPermission = (permission: string) => user.role.permissions.some((item) => item === permission);
  const canUseChats = hasPermission("USE_CHATS");
  const [unreadChats, setUnreadChats] = useState(0);
  const [profile, setProfile] = useState({ name: user.name, jobTitle: user.jobTitle, avatarUrl: user.avatarUrl });
  const accountLinks = links.filter(({ href }) => href === "/profile");
  const permittedLinks = links.filter(({ permission }) => !permission || hasPermission(permission));
  const visibleLinks = hasAccess
    ? hasPermission("MANAGE_USERS")
      ? [...permittedLinks, { href: "/admin", label: "Админ", icon: Shield }]
      : permittedLinks
    : accountLinks;
  const desktopLinks = visibleLinks.filter(({ href }) => href !== "/profile");
  const primaryMobileLinks = visibleLinks.filter(({ href }) => ["/board", "/files", "/chats", "/profile"].includes(href));
  const secondaryMobileLinks = visibleLinks.filter(({ href }) => !primaryMobileLinks.some((item) => item.href === href));
  const secondaryActive = secondaryMobileLinks.some(({ href }) => pathname === href);

  useEffect(() => {
    if (!hasAccess || !canUseChats) return;
    let active = true;
    async function refreshUnread() {
      const response = await fetch("/api/messages/conversations", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (active && response.ok) setUnreadChats(Number(payload.unreadTotal) || 0);
    }
    void refreshUnread();
    const timer = window.setInterval(() => void refreshUnread(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [canUseChats, hasAccess, pathname]);

  useEffect(() => {
    setProfile({ name: user.name, jobTitle: user.jobTitle, avatarUrl: user.avatarUrl });
  }, [user.name, user.jobTitle, user.avatarUrl]);

  useEffect(() => {
    const updateProfile = (event: Event) => {
      const detail = (event as CustomEvent<Partial<typeof profile>>).detail;
      if (detail) setProfile((current) => ({ ...current, ...detail }));
    };
    window.addEventListener("profileupdated", updateProfile);
    return () => window.removeEventListener("profileupdated", updateProfile);
  }, []);

  return (
    <>
      <nav className="nav nav-desktop" aria-label="Основная навигация">
        <div className="nav-links">
          {desktopLinks.map(({ href, label, icon: Icon }) => (
            <Link className={href === "/chats" ? "nav-chat-link" : undefined} aria-current={pathname === href ? "page" : undefined} href={href} key={href}>
              <Icon size={18} aria-hidden="true" /><span>{label}</span>
              {href === "/chats" && unreadChats ? <span className="nav-unread-badge" aria-label={`Непрочитанных сообщений: ${unreadChats}`}>{unreadChats > 99 ? "99+" : unreadChats}</span> : null}
            </Link>
          ))}
        </div>
        <div className="sidebar-account">
          <Link className="sidebar-profile-link" aria-current={pathname === "/profile" ? "page" : undefined} href="/profile">
            <ProfileAvatar name={profile.name} avatarUrl={profile.avatarUrl} size={40} />
            <span className="sidebar-profile-copy"><strong>{profile.name}</strong><small>{profile.jobTitle || "Изменить профиль"}</small></span>
          </Link>
          <div className="sidebar-account-actions"><ThemeToggle icon={<Moon size={18} aria-hidden="true" />} /><LogoutButton /></div>
        </div>
      </nav>

      <nav className="mobile-nav" aria-label="Мобильная навигация">
        {primaryMobileLinks.map(({ href, label, icon: Icon }) => (
          <Link className={href === "/chats" ? "nav-chat-link" : undefined} aria-current={pathname === href ? "page" : undefined} href={href} key={href}>
            <Icon size={20} aria-hidden="true" /><span>{label}</span>
            {href === "/chats" && unreadChats ? <span className="nav-unread-badge" aria-label={`Непрочитанных сообщений: ${unreadChats}`}>{unreadChats > 99 ? "99+" : unreadChats}</span> : null}
          </Link>
        ))}
        <details className="mobile-nav-more">
          <summary aria-label="Открыть дополнительную навигацию" className={secondaryActive ? "is-active" : undefined}>
            <MoreHorizontal size={21} aria-hidden="true" /><span>Ещё</span>
          </summary>
          <div className="mobile-nav-menu">
            {secondaryMobileLinks.map(({ href, label, icon: Icon }) => (
              <Link aria-current={pathname === href ? "page" : undefined} href={href} key={href}><Icon size={19} aria-hidden="true" />{label}</Link>
            ))}
            <ThemeToggle icon={<Moon size={19} aria-hidden="true" />} /><LogoutButton />
          </div>
        </details>
      </nav>
    </>
  );
}
