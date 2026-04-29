import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { getActiveWorkspaceState, getRoleViewLabel, hasRealWorkspace } from "@/lib/course-workspace"
import { formatWorkspaceFullLabel } from "@/lib/workspace-labels"
import { changeOwnPassword, signOutToLogin } from "./account-actions"
import { setAdminConsoleMode } from "./workspace-actions"
import { DashboardShell } from "./dashboard-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  const { activeWorkspace, activeRoleView, isAdminConsole } = await getActiveWorkspaceState(user)
  const canManageAssessments = activeRoleView !== "faculty"
  const canAccessSections = activeRoleView !== "faculty" || activeWorkspace.isElective
  const isAdmin = isAdminConsole
  const hasWorkspace = hasRealWorkspace(activeWorkspace)
  const sidebarSubtitle = isAdmin
    ? "Administrator Console"
    : hasWorkspace
      ? `${getRoleViewLabel(activeRoleView)} Workspace`
      : "Choose a workspace"
  const headerLabel = isAdmin
    ? "Administrator View"
    : hasWorkspace
      ? formatWorkspaceFullLabel(activeWorkspace)
      : "No Workspace Selected"

  return (
    <DashboardShell
      isAdmin={isAdmin}
      hasWorkspace={hasWorkspace}
      activeRoleLabel={getRoleViewLabel(activeRoleView)}
      sidebarSubtitle={sidebarSubtitle}
      headerLabel={headerLabel}
      userIsAdmin={user.isAdmin}
      isAdminConsole={isAdminConsole}
      canManageAssessments={canManageAssessments}
      canAccessSections={canAccessSections}
      userName={user.name ?? "Account"}
      userInitials={user.firstName?.[0] || user.name?.[0] || "U"}
      showAnalysisPreview={hasWorkspace && !isAdmin}
      switchAdminModeAction={setAdminConsoleMode}
      signOutAction={signOutToLogin}
      changePasswordAction={changeOwnPassword}
    >
      {children}
    </DashboardShell>
  )
}
