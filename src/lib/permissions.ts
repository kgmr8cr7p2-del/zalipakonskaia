import { PermissionKey, type Task } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/role-permissions";

export function isAdmin(user: CurrentUser) {
  return hasPermission(user, PermissionKey.MANAGE_USERS);
}

export function canManageColumns(user: CurrentUser) {
  return hasPermission(user, PermissionKey.VIEW_BOARD) && hasPermission(user, PermissionKey.MANAGE_COLUMNS);
}

export function canCreateTask(user: CurrentUser) {
  return hasPermission(user, PermissionKey.VIEW_BOARD) && hasPermission(user, PermissionKey.CREATE_TASKS);
}

type TaskWithAssignees = Pick<Task, "assigneeId"> & { assignees?: Array<{ userId: string }> };

export function canEditTask(user: CurrentUser, task?: TaskWithAssignees | null) {
  if (!hasPermission(user, PermissionKey.VIEW_BOARD)) return false;
  if (hasPermission(user, PermissionKey.EDIT_ALL_TASKS)) return true;
  return Boolean(task && (task.assigneeId === user.id || task.assignees?.some((assignment) => assignment.userId === user.id)));
}

export function canDeleteTask(user: CurrentUser) {
  return hasPermission(user, PermissionKey.VIEW_BOARD) && hasPermission(user, PermissionKey.DELETE_TASKS);
}

export function canDeleteComment(user: CurrentUser, authorId: string) {
  return isAdmin(user) || user.id === authorId;
}
