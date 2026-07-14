"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type RoleItem = { id: string; name: string; systemKey: string | null; permissions: string[] };
type AdminUser = {
  id: string;
  name: string;
  lastName: string;
  firstName: string;
  middleName: string;
  email: string;
  emailVerifiedAt: string | null;
  approvedAt: string | null;
  role: RoleItem;
};
type UserInvite = { id: string; email: string; acceptedAt: string | null; role: RoleItem };

export function AdminUsers({
  currentUserId,
  invites,
  users,
  roles,
}: {
  currentUserId: string;
  invites: UserInvite[];
  users: AdminUser[];
  roles: RoleItem[];
}) {
  const [items, setItems] = useState(users);
  const [pendingInvites, setPendingInvites] = useState(invites);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const defaultRoleId = roles.find((role) => role.systemKey === "EXECUTOR")?.id ?? roles[0]?.id ?? "";

  useEffect(() => setItems(users), [users]);
  useEffect(() => setPendingInvites(invites), [invites]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
    if (!normalized) return items;
    return items.filter((user) => {
      const fullName = `${user.lastName} ${user.firstName} ${user.middleName} ${user.name}`.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
      return fullName.includes(normalized);
    });
  }, [items, query]);

  async function changeRole(id: string, roleId: string) {
    setMessage("");
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roleId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error ?? "Не удалось изменить роль");
    setItems((current) => current.map((user) => user.id === id ? data.user : user));
    setMessage(`Пользователю назначена роль «${data.user.role.name}».`);
  }

  async function changeAccess(id: string, approved: boolean) {
    setMessage("");
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error ?? "Не удалось изменить доступ");
    setItems((current) => current.map((user) => user.id === id ? data.user : user));
    setMessage(approved ? "Доступ пользователю разрешён." : "Доступ пользователя отозван.");
  }

  async function inviteUser(formData: FormData) {
    setMessage("");
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const roleId = String(formData.get("roleId") ?? "");
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, roleId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error ?? "Не удалось добавить пользователя");

    if (data.user) {
      setItems((current) => current.map((user) => user.id === data.user.id ? data.user : user));
      setMessage(`Пользователю назначена роль «${data.user.role.name}».`);
      return;
    }
    if (data.invite) {
      setPendingInvites((current) => [data.invite, ...current.filter((invite) => invite.id !== data.invite.id)]);
      setMessage("Приглашение сохранено.");
    }
  }

  return (
    <div className="admin-users">
      <form className="admin-invite-form" action={inviteUser}>
        <label className="field">
          <span className="label">Почта</span>
          <input className="input" name="email" type="email" placeholder="name@company.ru" required />
        </label>
        <label className="field">
          <span className="label">Роль</span>
          <select className="select" name="roleId" defaultValue={defaultRoleId} required>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        </label>
        <button className="button">Сохранить приглашение</button>
      </form>

      <label className="field admin-user-search">
        <span className="label">Поиск пользователя по ФИО</span>
        <span className="admin-user-search-control">
          <Search size={18} aria-hidden="true" />
          <input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Например, Иванов Иван" />
        </span>
      </label>

      {message ? <p className="chip" role="status">{message}</p> : null}
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Почта</th>
              <th>Статус почты</th>
              <th>Доступ</th>
              <th>Роль</th>
            </tr>
          </thead>
          <tbody>
            {!query.trim() ? pendingInvites.map((invite) => (
              <tr key={invite.id}>
                <td>Ожидает регистрации</td>
                <td>{invite.email}</td>
                <td>Приглашён</td>
                <td>Ожидает регистрации</td>
                <td>{invite.role.name}</td>
              </tr>
            )) : null}
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.emailVerifiedAt ? "Подтверждена" : "Ожидает подтверждения"}</td>
                <td>
                  <button
                    className={`button ${user.approvedAt ? "secondary" : ""}`}
                    type="button"
                    disabled={!user.emailVerifiedAt || (user.id === currentUserId && Boolean(user.approvedAt))}
                    title={!user.emailVerifiedAt
                      ? "Сначала пользователь должен подтвердить почту"
                      : user.id === currentUserId ? "Нельзя отозвать собственный административный доступ" : undefined}
                    onClick={() => changeAccess(user.id, !user.approvedAt)}
                  >
                    {user.approvedAt ? "Отозвать доступ" : "Разрешить доступ"}
                  </button>
                </td>
                <td>
                  <select className="select" value={user.role.id} onChange={(event) => changeRole(user.id, event.target.value)}>
                    {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {query.trim() && !filteredUsers.length ? (
              <tr><td colSpan={5}>Пользователь с таким ФИО не найден.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
