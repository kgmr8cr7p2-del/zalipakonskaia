"use client";

import { Check, LockKeyhole, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { permissionOptions, type PermissionValue } from "@/lib/role-permission-options";

type RoleItem = { id: string; name: string; systemKey: string | null; permissions: PermissionValue[]; _count?: { users: number; userInvites: number } };

const permissionGroups: Array<{ key: string; label: string; keys: PermissionValue[] }> = [
  { key: "work", label: "Рабочее пространство", keys: ["VIEW_BOARD", "CREATE_TASKS", "EDIT_ALL_TASKS", "DELETE_TASKS", "MANAGE_COLUMNS"] },
  { key: "insights", label: "Отчёты и документы", keys: ["VIEW_REPORTS", "VIEW_HISTORY", "VIEW_FILES", "MANAGE_FILES"] },
  { key: "communication", label: "Связь", keys: ["USE_CHATS", "USE_TELEGRAM"] },
  { key: "admin", label: "Администрирование", keys: ["MANAGE_WORKSPACE", "MANAGE_USERS"] },
];

export function RoleManager({ initialRoles }: { initialRoles: RoleItem[] }) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [selectedId, setSelectedId] = useState(initialRoles[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const [saving, setSaving] = useState(false);
  const [dirtyRoleIds, setDirtyRoleIds] = useState<Set<string>>(new Set());
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0] ?? null;

  const permissionMap = useMemo(() => new Map(permissionOptions.map((permission) => [permission.key, permission])), []);
  const enabledCount = selected?.permissions.length ?? 0;

  function updateSelected(patch: Partial<RoleItem>) {
    if (!selected) return;
    setRoles((current) => current.map((role) => role.id === selected.id ? { ...role, ...patch } : role));
    setDirtyRoleIds((current) => new Set(current).add(selected.id));
  }

  function togglePermission(permission: PermissionValue, checked: boolean) {
    if (!selected || selected.systemKey === "ADMIN") return;
    const permissions = checked
      ? Array.from(new Set([...selected.permissions, permission]))
      : selected.permissions.filter((item) => item !== permission);
    updateSelected({ permissions });
    setMessage("");
  }

  async function createRole(formData: FormData) {
    setSaving(true);
    setMessage("");
    const name = String(formData.get("name") ?? "").trim();
    const response = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, permissions: [] }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessageKind("error");
      setMessage(data.error ?? "Не удалось создать роль");
      return;
    }
    setRoles((current) => [...current, data.role]);
    setSelectedId(data.role.id);
    setMessageKind("success");
    setMessage(`Роль «${data.role.name}» создана. Теперь назначьте ей доступы.`);
    router.refresh();
  }

  async function saveRole() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/roles/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: selected.name, permissions: selected.permissions }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessageKind("error");
      setMessage(data.error ?? "Не удалось сохранить доступы");
      return;
    }
    setRoles((current) => current.map((role) => role.id === selected.id ? data.role : role));
    setDirtyRoleIds((current) => { const next = new Set(current); next.delete(selected.id); return next; });
    setMessageKind("success");
    setMessage(`Изменения роли «${data.role.name}» сохранены.`);
    router.refresh();
  }

  async function deleteRole() {
    if (!selected || selected.systemKey === "ADMIN" || !window.confirm(`Удалить роль «${selected.name}»?`)) return;
    const assignedCount = (selected._count?.users ?? 0) + (selected._count?.userInvites ?? 0);
    const replacement = roles.find((role) => role.id !== selected.id && role.systemKey === "MANAGER")
      ?? roles.find((role) => role.id !== selected.id && role.systemKey === "EXECUTOR")
      ?? roles.find((role) => role.id !== selected.id);
    if (assignedCount && !replacement) {
      setMessageKind("error");
      setMessage("Нельзя удалить роль: сначала создайте роль для переназначения пользователей.");
      return;
    }
    setSaving(true);
    const response = await fetch(`/api/admin/roles/${selected.id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ replacementRoleId: assignedCount ? replacement?.id : undefined }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessageKind("error");
      setMessage(data.error ?? "Не удалось удалить роль");
      return;
    }
    const next = roles.filter((role) => role.id !== selected.id);
    setRoles(next);
    setSelectedId(next[0]?.id ?? "");
    setMessageKind("success");
    setMessage(`Роль «${selected.name}» удалена.`);
    router.refresh();
  }

  return (
    <section className="role-manager" aria-labelledby="role-manager-title">
      <header className="role-manager-head">
        <div className="role-manager-intro">
          <span className="section-kicker"><ShieldCheck size={15} /> Доступ к Taskora</span>
          <h2 id="role-manager-title">Роли и права</h2>
          <p className="muted">Соберите понятные профили доступа и назначайте их сотрудникам без длинных раскрывающихся списков.</p>
        </div>
        <form className="role-create-form" action={createRole}>
          <label className="field">
            <span className="label">Новая роль</span>
            <input className="input" name="name" minLength={2} maxLength={60} placeholder="Например, координатор" required />
          </label>
          <button className="button" disabled={saving}><Plus size={16} />Создать роль</button>
        </form>
      </header>

      {message ? <p className={`role-manager-message ${messageKind}`} role="status">{message}</p> : null}

      <div className="role-manager-layout">
        <aside className="role-directory" aria-label="Список ролей">
          <div className="role-directory-head"><span>Роли</span><strong>{roles.length}</strong></div>
          <div className="role-directory-list">
            {roles.map((role) => <button className={`role-directory-item ${selected?.id === role.id ? "is-active" : ""}`} type="button" key={role.id} onClick={() => { setSelectedId(role.id); setMessage(""); }}>
              <span className="role-directory-mark">{role.systemKey === "ADMIN" ? <LockKeyhole size={16} /> : <ShieldCheck size={16} />}</span>
              <span className="role-directory-copy"><strong>{role.name}</strong><small>{role.systemKey ? "Системная роль" : "Пользовательская роль"}</small></span>
              <span className="role-directory-count">{role.systemKey === "ADMIN" ? "Все" : role.permissions.length}</span>
            </button>)}
          </div>
        </aside>

        {selected ? <div className="role-editor">
          <header className="role-editor-head">
            <div><span className="role-editor-label">Редактирование роли</span><h3>{selected.name}{dirtyRoleIds.has(selected.id) ? <span className="role-unsaved">Есть несохранённые изменения</span> : null}</h3><p className="muted">{selected.systemKey === "ADMIN" ? "Системный администратор получает полный доступ автоматически." : `${enabledCount} из ${permissionOptions.length} доступов включено`}</p></div>
            <div className="role-editor-actions">
              {selected.systemKey !== "ADMIN" ? <button className="button ghost danger-text" type="button" onClick={() => void deleteRole()} disabled={saving}><Trash2 size={16} />Удалить</button> : null}
              <button className="button" type="button" onClick={() => void saveRole()} disabled={saving}><Save size={16} />{saving ? "Сохраняем" : "Сохранить"}</button>
            </div>
          </header>
          <label className="field role-name-field"><span className="label">Название роли</span><input className="input" value={selected.name} minLength={2} maxLength={60} disabled={selected.systemKey === "ADMIN"} onChange={(event) => updateSelected({ name: event.currentTarget.value })} /></label>
          {selected.systemKey !== "ADMIN" && ((selected._count?.users ?? 0) + (selected._count?.userInvites ?? 0) > 0) ? <p className="role-danger-note">При удалении назначенные пользователи и приглашения будут переназначены на роль «Менеджер» или «Исполнитель».</p> : null}
          <div className="permission-groups">
            {permissionGroups.map((group) => <section className="permission-group" key={group.key}>
              <header><div><h4>{group.label}</h4><p>{group.keys.length} разрешения</p></div></header>
              <div className="permission-grid">
                {group.keys.map((key) => {
                  const permission = permissionMap.get(key)!;
                  const checked = selected.systemKey === "ADMIN" || selected.permissions.includes(key);
                  return <label className={`permission-option ${checked ? "is-checked" : ""}`} key={key}>
                    <input type="checkbox" checked={checked} disabled={selected.systemKey === "ADMIN" || saving} onChange={(event) => togglePermission(key, event.currentTarget.checked)} />
                    <span className="permission-check"><Check size={14} /></span>
                    <span className="permission-copy"><strong>{permission.label}</strong><small>{permission.description}</small></span>
                  </label>;
                })}
              </div>
            </section>)}
          </div>
        </div> : <div className="role-editor role-editor-empty"><ShieldCheck size={26} /><h3>Создайте первую роль</h3><p className="muted">Новая роль появится в списке и будет готова к настройке.</p></div>}
      </div>
    </section>
  );
}
