import type { AuthenticatedUser } from "@/types/auth";

export function hasPermission(user: AuthenticatedUser, permission: string): boolean {
  if (user.role === "owner") {
    return true;
  }

  return user.permissions.includes(permission);
}

export function hasRole(
  user: AuthenticatedUser,
  roles: Array<"owner" | "admin" | "member" | "viewer">
): boolean {
  return roles.includes(user.role);
}
