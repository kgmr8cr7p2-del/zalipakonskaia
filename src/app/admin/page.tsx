import { PermissionKey } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { AdminUsers } from "@/components/AdminUsers";
import { RoleManager } from "@/components/RoleManager";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  const user = await requirePermission(PermissionKey.MANAGE_USERS);
  const [users, invites, roles] = await Promise.all([
    prisma.user.findMany({ include: { role: true }, orderBy: { createdAt: "desc" } }),
    prisma.userInvite.findMany({ where: { acceptedAt: null }, include: { role: true }, orderBy: { createdAt: "desc" } }),
    prisma.role.findMany({ orderBy: [{ systemKey: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <AppShell user={user}>
      <div className="content">
        <section className="panel">
          <h1>Админ-панель</h1>
          <p className="muted">Добавьте email и роль. Пользователь сам зарегистрируется по этой почте, а имя укажет при регистрации.</p>
          <AdminUsers currentUserId={user.id} invites={JSON.parse(JSON.stringify(invites))} users={JSON.parse(JSON.stringify(users))} roles={JSON.parse(JSON.stringify(roles))} />
        </section>
        <RoleManager initialRoles={JSON.parse(JSON.stringify(roles))} />
      </div>
    </AppShell>
  );
}
