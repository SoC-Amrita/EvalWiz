"use server"

import { auth } from "@/auth"
import { getActiveWorkspaceState, setActiveWorkspaceCookies, setAdminConsoleModeCookie, type WorkspaceRoleView } from "@/lib/course-workspace"
import { canManageUsers } from "@/lib/user-roles"

export async function activateWorkspace(courseKey: string, roleView: WorkspaceRoleView) {
  const session = await auth()
  const user = session?.user
  if (!user) {
    throw new Error("Unauthorized")
  }

  const { workspaces } = await getActiveWorkspaceState(user)
  const workspace = workspaces.find((item) => item.key === courseKey)
  if (!workspace) {
    throw new Error("Workspace not found")
  }

  if (!workspace.availableRoleViews.includes(roleView)) {
    throw new Error("That role is not available for the selected workspace")
  }

  await setActiveWorkspaceCookies(courseKey, roleView)
  return { success: true }
}

export async function setAdminConsoleMode(mode: "admin" | "workspace") {
  const session = await auth()
  const user = session?.user
  if (!user || !canManageUsers(user)) {
    throw new Error("Unauthorized")
  }

  await setAdminConsoleModeCookie(mode)
  return { success: true }
}
