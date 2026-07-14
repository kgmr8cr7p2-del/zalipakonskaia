import { PermissionKey } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth";

export const SYSTEM_ROLE_KEYS = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  EXECUTOR: "EXECUTOR",
} as const;

export function hasPermission(user: CurrentUser, permission: PermissionKey) {
  return user.role.permissions.includes(permission);
}

export function hasAnyPermission(user: CurrentUser, permissions: PermissionKey[]) {
  return permissions.some((permission) => hasPermission(user, permission));
}
