"use client";

import { useState } from "react";

const roleLabels = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  EXECUTOR: "Исполнитель",
};

type RoleKey = keyof typeof roleLabels;
type AdminUser = { id: string; name: string; email: string; emailVerifiedAt: string | null; approvedAt: string | null; role: { name: RoleKey } };
type UserInvite = { id: string; email: string; acceptedAt: string | null; role: { name: RoleKey } };

export function AdminUsers({ currentUserId, invites, users }: { currentUserId: string; invites: UserInvite[]; users: AdminUser[] }) {
  const [items, setItems] = useState(users);
  const [pendingInvites, setPendingInvites] = useState(invites);
  const [message, setMessage] = useState("");

  async function changeRole(id: string, role: string) {
    setMessage("");
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error ?? "Не удалось изменить роль");
    setItems((current) => current.map((user) => (user.id === id ? data.user : user)));
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
    setItems((current) => current.map((user) => (user.id === id ? data.user : user)));
    setMessage(approved ? "Доступ пользователю разрешён" : "Доступ пользователя отозван");
  }

  async function inviteUser(formData: FormData) {
    setMessage("");
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = String(formData.get("role") ?? "EXECUTOR");
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Не удалось добавить пользователя");
      return;
    }

    if (data.user) {
      setItems((current) => current.map((user) => (user.id === data.user.id ? data.user : user)));
      setMessage("Роль существующего пользователя обновлена");
      return;
    }

    if (data.invite) {
      setPendingInvites((current) => [data.invite, ...current.filter((invite) => invite.id !== data.invite.id)]);
      setMessage("Приглашение сохранено");
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
          <select className="select" name="role" defaultValue="EXECUTOR">
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="button">Добавить</button>
      </form>
      {message ? <p className="chip" role="status">{message}</p> : null}
      <table className="table">
        <thead>
          <tr>
            <th>Пользователь</th>
            <th>Почта</th>
            <th>Статус</th>
            <th>Доступ</th>
            <th>Роль</th>
          </tr>
        </thead>
        <tbody>
          {pendingInvites.map((invite) => (
            <tr key={invite.id}>
              <td>Ожидает регистрации</td>
              <td>{invite.email}</td>
              <td>Приглашен</td>
              <td>Ожидает регистрации</td>
              <td>{roleLabels[invite.role.name]}</td>
            </tr>
          ))}
          {items.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.emailVerifiedAt ? "Подтверждена" : "Ожидает"}</td>
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
                  {user.approvedAt ? "Отозвать" : "Разрешить"}
                </button>
              </td>
              <td>
                <select className="select" value={user.role.name} onChange={(event) => changeRole(user.id, event.target.value)}>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
