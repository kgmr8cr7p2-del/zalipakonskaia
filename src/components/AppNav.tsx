"use client";

import Link from "next/link";
import { Archive, BarChart3, History, LayoutDashboard, MessageCircle, Moon, MoreHorizontal, Settings, Shield, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { ProfileAvatar } from "@/components/ProfileCard/ProfileCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { CurrentUser } from "@/lib/auth";

const links = [
  { href: "/board", label: "Доска", icon: LayoutDashboard },
  { href: "/chats", label: "Чаты", icon: MessageCircle },
  { href: "/reports", label: "Отчеты", icon: BarChart3 },
  { href: "/history", label: "История", icon: History },
  { href: "/archive", label: "Архив", icon: Archive },
  { href: "/profile", label: "Профиль", icon: UserRound },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function AppNav({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const [unreadChats, setUnreadChats] = useState(0);
  const visibleLinks = user.role.name === "ADMIN" ? [...links, { href: "/admin", label: "Админ", icon: Shield }] : links;
  const desktopLinks = visibleLinks.filter(({ href }) => href !== "/profile");
  const primaryMobileLinks = visibleLinks.filter(({ href }) => ["/board", "/chats", "/reports", "/profile"].includes(href));
  const secondaryMobileLinks = visibleLinks.filter(({ href }) => !primaryMobileLinks.some((item) => item.href === href));
  const secondaryActive = secondaryMobileLinks.some(({ href }) => pathname === href);

  useEffect(() => {
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
  }, [pathname]);

  return (
    <>
      <nav className="nav nav-desktop" aria-label="Основная навигация">
        <div className="nav-links">
          {desktopLinks.map(({ href, label, icon: Icon }) => (
            <Link className={href === "/chats" ? "nav-chat-link" : undefined} aria-current={pathname === href ? "page" : undefined} href={href} key={href}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {href === "/chats" && unreadChats ? <span className="nav-unread-badge" aria-label={`Непрочитанных сообщений: ${unreadChats}`}>{unreadChats > 99 ? "99+" : unreadChats}</span> : null}
            </Link>
          ))}
        </div>
        <div className="sidebar-account">
          <Link className="sidebar-profile-link" aria-current={pathname === "/profile" ? "page" : undefined} href="/profile">
            <ProfileAvatar name={user.name} avatarUrl={user.avatarUrl} size={40} />
            <span className="sidebar-profile-copy">
              <strong>{user.name}</strong>
              <small>{user.jobTitle || "Изменить профиль"}</small>
            </span>
          </Link>
          <div className="sidebar-account-actions">
            <ThemeToggle icon={<Moon size={18} aria-hidden="true" />} />
            <LogoutButton />
          </div>
        </div>
      </nav>

      <nav className="mobile-nav" aria-label="Мобильная навигация">
        {primaryMobileLinks.map(({ href, label, icon: Icon }) => (
          <Link className={href === "/chats" ? "nav-chat-link" : undefined} aria-current={pathname === href ? "page" : undefined} href={href} key={href}>
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
            {href === "/chats" && unreadChats ? <span className="nav-unread-badge" aria-label={`Непрочитанных сообщений: ${unreadChats}`}>{unreadChats > 99 ? "99+" : unreadChats}</span> : null}
          </Link>
        ))}
        <details className="mobile-nav-more">
          <summary aria-label="Открыть дополнительную навигацию" className={secondaryActive ? "is-active" : undefined}>
            <MoreHorizontal size={21} aria-hidden="true" />
            <span>Ещё</span>
          </summary>
          <div className="mobile-nav-menu">
            {secondaryMobileLinks.map(({ href, label, icon: Icon }) => (
              <Link aria-current={pathname === href ? "page" : undefined} href={href} key={href}>
                <Icon size={19} aria-hidden="true" />
                {label}
              </Link>
            ))}
            <ThemeToggle icon={<Moon size={19} aria-hidden="true" />} />
            <LogoutButton />
          </div>
        </details>
      </nav>
    </>
  );
}
