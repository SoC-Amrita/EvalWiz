type RoleContext =
  | {
      isAdmin?: boolean | null
    }
  | undefined
  | null

function getIsAdmin(context?: RoleContext | null) {
  return context?.isAdmin === true
}

export function isAdminRole(context?: RoleContext | null) {
  return getIsAdmin(context)
}

export function canManageUsers(context?: RoleContext | null) {
  return getIsAdmin(context)
}
