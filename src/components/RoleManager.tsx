"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { permissionOptions, type PermissionValue } from "@/lib/role-permission-options";

type RoleItem = { id: string; name: string; systemKey: string | null; permissions: PermissionValue[] };

export function RoleManager({ initialRoles }: { initialRoles: RoleItem[] }) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [message, setMessage] = useState("");

  function updateRole(id: string, patch: Partial<RoleItem>) {
    setRoles((current) => current.map((role) => role.id === id ? { ...role, ...patch } : role));
  }

  function togglePermission(id: string, permission: PermissionValue, checked: boolean) {
    const role = roles.find((item) => item.id === id);
    if (!role) return;
    const permissions = checked
      ? Array.from(new Set([...role.permissions, permission]))
      : role.permissions.filter((item) => item !== permission);
    updateRole(id, { permissions });
  }

  async function createRole(formData: FormData) {
    setMessage("");
    const name = String(formData.get("name") ?? "").trim();
    const response = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, permissions: [] }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error ?? "Не удалось создать роль");
    setRoles((current) => [...current, data.role]);
    setMessage(`Роль «${data.role.name}» создана. Настройте её права ниже.`);
    router.refresh();
  }

  async function saveRole(role: RoleItem) {
    setMessage("");
    const response = await fetch(`/api/admin/roles/${role.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: role.name, permissions: role.permissions }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error ?? "Не удалось сохранить роль");
    updateRole(role.id, data.role);
    setMessage(`Права роли «${data.role.name}» сохранены.`);
    router.refresh();
  }

  async function deleteRole(role: RoleItem) {
    if (!window.confirm(`Удалить роль «${role.name}»? Это действие нельзя отменить.`)) return;
    setMessage("");
    const response = await fetch(`/api/admin/roles/${role.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error ?? "Не удалось удалить роль");
    setRoles((current) => current.filter((item) => item.id !== role.id));
    setMessage(`Роль «${role.name}» удалена.`);
    router.refresh();
  }

  return (
    <section className="panel role-manager">
      <header className="role-manager-head">
        <div>
          <h2>Роли и права</h2>
          <p className="muted">Создавайте роли и отмечайте только те действия, которые им разрешены.</p>
        </div>
        <form className="role-create-form" action={createRole}>
          <label className="field">
            <span className="label">Название новой роли</span>
            <input className="input" name="name" minLength={2} maxLength={60} placeholder="Например, Наблюдатель" required />
          </label>
          <button className="button">Создать роль</button>
        </form>
      </header>
      {message ? <p className="chip" role="status">{message}</p> : null}
      <div className="role-list">
        {roles.map((role) => (
          <details className="role-card" key={role.id} open={role.systemKey === "ADMIN"}>
            <summary>
              <span><strong>{role.name}</strong>{role.systemKey ? <small>Встроенная роль</small> : <small>Пользовательская роль</small>}</span>
              <span className="chip">Прав: {role.permissions.length}</span>
            </summary>
            <div className="role-card-body">
              <label className="field">
                <span className="label">Название роли</span>
                <input className="input" value={role.name} minLength={2} maxLength={60} onChange={(event) => updateRole(role.id, { name: event.target.value })} />
              </label>
              <fieldset className="role-permission-grid">
                <legend>Разрешённые действия</legend>
                {permissionOptions.map((permission) => {
                  const protectedAdminPermission = role.systemKey === "ADMIN" && permission.key === "MANAGE_USERS";
                  return (
                    <label className="role-permission" key={permission.key}>
                      <input
                        type="checkbox"
                        checked={role.permissions.includes(permission.key)}
                        disabled={protectedAdminPermission}
                        onChange={(event) => togglePermission(role.id, permission.key, event.target.checked)}
                      />
                      <span><strong>{permission.label}</strong><small>{permission.description}</small></span>
                    </label>
                  );
                })}
              </fieldset>
              <div className="role-card-actions">
                {!role.systemKey ? <button className="button secondary" type="button" onClick={() => deleteRole(role)}>Удалить роль</button> : null}
                <button className="button" type="button" onClick={() => saveRole(role)}>Сохранить права</button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
