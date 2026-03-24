export type UserRole = "FACULTY"

type RoleContext =
  | {
      role?: string | null
      isAdmin?: boolean | null
    }
  | undefined
  | null

function getRole(context?: string | RoleContext | null) {
  if (typeof context === "string") return context
  return context?.role ?? null
}

function getIsAdmin(context?: string | RoleContext | null) {
  if (typeof context === "string") return false
  return context?.isAdmin === true
}

export function isAdminRole(context?: string | RoleContext | null) {
  return getIsAdmin(context)
}

export function isFacultyRole(context?: string | RoleContext | null) {
  return getRole(context) !== null
}

export function canManageCourse(context?: string | RoleContext | null) {
  return getIsAdmin(context)
}

export function canManageUsers(context?: string | RoleContext | null) {
  return getIsAdmin(context)
}
