type DashboardAuditUser = {
  id: string
  isAdmin?: boolean | null
}

export function buildDashboardAuditLogWhere(user: DashboardAuditUser) {
  if (user.isAdmin === true) {
    return {}
  }

  return { userId: user.id }
}
