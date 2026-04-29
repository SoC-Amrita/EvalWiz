import { getActiveWorkspaceState, getAllowedSectionIdsForWorkspace } from "@/lib/course-workspace"
import { canManageUsers } from "@/lib/user-roles"
import { getSessionUser } from "@/lib/session"

export async function requireAuthenticatedWorkspaceState() {
  const user = await getSessionUser()
  if (!user) {
    throw new Error("Unauthorized")
  }

  return {
    user,
    ...(await getActiveWorkspaceState(user)),
  }
}

export async function requireWorkspaceManagerState() {
  const workspaceState = await requireAuthenticatedWorkspaceState()
  if (workspaceState.activeRoleView === "faculty") {
    throw new Error("Unauthorized")
  }
  return workspaceState
}

export async function requireAllowedSectionAccess() {
  const workspaceState = await requireAuthenticatedWorkspaceState()
  return {
    ...workspaceState,
    allowedSectionIds: new Set(
      await getAllowedSectionIdsForWorkspace(
        workspaceState.user,
        workspaceState.activeWorkspace,
        workspaceState.activeRoleView
      )
    ),
  }
}

export async function requireAdminUser() {
  const user = await getSessionUser()
  if (!user || !canManageUsers(user)) {
    throw new Error("Unauthorized")
  }
  return user
}

export function requireRealWorkspace(
  workspace: { offeringId: string },
  message = "Select an active course offering before continuing"
) {
  if (!workspace.offeringId) {
    throw new Error(message)
  }
}
