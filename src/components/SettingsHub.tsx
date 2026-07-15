"use client";

import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export type SettingsPanel = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  content: ReactNode;
};

export function SettingsHub({ panels }: { panels: SettingsPanel[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = panels.find((panel) => panel.id === activeId) ?? null;

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setActiveId(null); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active]);

  return (
    <section className="settings-hub" aria-label="Разделы настроек">
      <div className="settings-choice-grid">
        {panels.map((panel) => {
          const Icon = panel.icon;
          return <button className="settings-choice" type="button" key={panel.id} onClick={() => setActiveId(panel.id)}>
            <span className="settings-choice-icon"><Icon size={20} /></span>
            <span className="settings-choice-copy"><strong>{panel.title}</strong><small>{panel.description}</small></span>
            <span className="settings-choice-arrow" aria-hidden="true">→</span>
          </button>;
        })}
      </div>

      {active ? <div className="settings-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveId(null); }}>
        <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby={`settings-dialog-${active.id}`}>
          <header className="settings-dialog-head">
            <div><span className="settings-page-kicker">Настройка Taskora</span><h2 id={`settings-dialog-${active.id}`}>{active.title}</h2><p className="muted">{active.description}</p></div>
            <button className="button icon ghost" type="button" aria-label="Закрыть окно настроек" onClick={() => setActiveId(null)}><X size={18} /></button>
          </header>
          <div className="settings-dialog-body">{active.content}</div>
        </section>
      </div> : null}
    </section>
  );
}
