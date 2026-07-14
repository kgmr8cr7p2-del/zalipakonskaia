import { RoleName } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { AdminUsers } from "@/components/AdminUsers";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  const user = await requireRole([RoleName.ADMIN]);
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
  const invites = await prisma.userInvite.findMany({
    where: { acceptedAt: null },
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell user={user}>
      <div className="content">
        <section className="panel">
          <h1>Админ-панель</h1>
          <p className="muted">Добавьте email и роль. Пользователь сам зарегистрируется по этой почте, а имя укажет при регистрации.</p>
          <AdminUsers currentUserId={user.id} invites={JSON.parse(JSON.stringify(invites))} users={JSON.parse(JSON.stringify(users))} />
        </section>
      </div>
    </AppShell>
  );
}
