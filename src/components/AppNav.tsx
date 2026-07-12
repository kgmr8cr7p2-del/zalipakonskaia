"use client";

import Link from "next/link";
import { Archive, BarChart3, History, LayoutDashboard, Moon, MoreHorizontal, Settings, Shield, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

const links = [
  { href: "/board", label: "Доска", icon: LayoutDashboard },
  { href: "/reports", label: "Отчеты", icon: BarChart3 },
  { href: "/history", label: "История", icon: History },
  { href: "/archive", label: "Архив", icon: Archive },
  { href: "/profile", label: "Профиль", icon: UserRound },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const visibleLinks = isAdmin ? [...links, { href: "/admin", label: "Админ", icon: Shield }] : links;
  const primaryMobileLinks = visibleLinks.filter(({ href }) => ["/board", "/reports", "/history", "/profile"].includes(href));
  const secondaryMobileLinks = visibleLinks.filter(({ href }) => !primaryMobileLinks.some((item) => item.href === href));
  const secondaryActive = secondaryMobileLinks.some(({ href }) => pathname === href);

  return (
    <>
      <nav className="nav nav-desktop" aria-label="Основная навигация">
        {visibleLinks.map(({ href, label, icon: Icon }) => (
          <Link aria-current={pathname === href ? "page" : undefined} href={href} key={href}>
            <Icon size={18} aria-hidden="true" />
            {label}
          </Link>
        ))}
        <ThemeToggle icon={<Moon size={18} aria-hidden="true" />} />
        <LogoutButton />
      </nav>

      <nav className="mobile-nav" aria-label="Мобильная навигация">
        {primaryMobileLinks.map(({ href, label, icon: Icon }) => (
          <Link aria-current={pathname === href ? "page" : undefined} href={href} key={href}>
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
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
