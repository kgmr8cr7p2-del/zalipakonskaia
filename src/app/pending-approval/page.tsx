import Link from "next/link";
import { Clock3, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireAccountUser } from "@/lib/auth";

export default async function PendingApprovalPage() {
  const user = await requireAccountUser();
  if (user.approvedAt) redirect("/board");

  return (
    <AppShell user={user}>
      <div className="content">
        <section className="panel pending-approval-panel">
          <span className="profile-page-kicker"><Clock3 size={17} aria-hidden="true" /> Ожидание доступа</span>
          <h1>Аккаунт ожидает одобрения администратора</h1>
          <p className="muted">
            Почта подтверждена, но рабочие доски, задачи, чаты, отчёты, файлы и Telegram пока закрыты.
            Администратор получил уведомление о регистрации и должен лично разрешить доступ.
          </p>
          <div className="form-actions">
            <Link className="button" href="/profile"><UserRound size={17} aria-hidden="true" /> Настроить свой профиль</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
