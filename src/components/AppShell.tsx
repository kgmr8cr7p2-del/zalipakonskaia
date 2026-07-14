import Image from "next/image";
import type { CurrentUser } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import { GoidaReminder } from "@/components/GoidaReminder";
import { TaskSoundNotifier } from "@/components/TaskSoundNotifier";
import { WeeklyReportReminder } from "@/components/WeeklyReportReminder";
import { PresenceTracker } from "@/components/PresenceTracker";

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Image className="brand-icon-image" src="/taskora-icon.png" width={32} height={32} alt="" />
          </span>
          <span>Taskora</span>
        </div>
        <AppNav user={user} />
      </aside>
      <main className="main">{children}</main>
      {user.approvedAt ? (
        <>
          <TaskSoundNotifier />
          <GoidaReminder />
          <WeeklyReportReminder />
          <PresenceTracker />
        </>
      ) : null}
    </div>
  );
}
