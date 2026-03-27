import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import type { ComponentType } from "react"
import { APP_INFO } from "@/lib/app-info"
import { getActiveWorkspaceState, getRoleViewLabel, hasRealWorkspace } from "@/lib/course-workspace"
import { AdminModeSwitchButton } from "./admin-mode-switch-button"
import { changeOwnPassword, signOutToLogin } from "./account-actions"
import { UserMenu } from "./user-menu"
import { 
  BarChart, 
  Users, 
  BookOpen, 
  Settings, 
  GraduationCap, 
  FileSpreadsheet 
} from "lucide-react"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const user = session?.user
  
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
      ? `${activeWorkspace.subjectCode} · ${activeWorkspace.subjectTitle}`
      : "Choose an active offering to unlock course tools"
  const headerLabel = isAdmin
    ? "Administrator View"
    : hasWorkspace
      ? `${activeWorkspace.program} · ${activeWorkspace.term}`
      : "No Workspace Selected"

  return (
    <div className="relative flex min-h-screen overflow-hidden app-shell">
      <div className="pointer-events-none absolute inset-0 app-grid opacity-60" />
      {/* Sidebar Navigation */}
      <aside className="relative z-10 hidden w-64 flex-col border-r border-border/80 bg-background/85 backdrop-blur-xl md:flex">
        <div className="flex items-center space-x-3 border-b border-border/80 p-6">
          <div className="rounded-lg bg-primary/12 p-2 text-primary ring-1 ring-primary/15">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-semibold tracking-tight text-foreground">{APP_INFO.name}</span>
            <p className="text-xs text-muted-foreground">
              {sidebarSubtitle}
            </p>
            {isAdmin ? (
              <p className="mt-1 text-[11px] text-muted-foreground/80">
                Course-specific tools only apply after you explicitly select a workspace.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground/80">
                {getRoleViewLabel(activeRoleView)} Workspace
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-3">
          {isAdmin ? (
            <AdminModeSwitchButton targetMode="workspace" />
          ) : user.isAdmin ? (
            <AdminModeSwitchButton targetMode="admin" />
          ) : (
            <Link href="/dashboard" className="text-xs font-medium text-primary hover:underline">
              Switch Workspace
            </Link>
          )}
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="mb-2 mt-4 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overview</div>
          <NavLink href="/dashboard" icon={BarChart} label={isAdmin ? "Admin Console" : "Workspace Home"} />

          {isAdmin ? (
            <>
              <div className="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Administration</div>
              <NavLink href="/dashboard/academic-setup" icon={Settings} label="Academic Setup" />
              <NavLink href="/dashboard/students" icon={Users} label="Student Master List" />
              <NavLink href="/dashboard/users" icon={Users} label="User Admin" />
            </>
          ) : (
            <>
              <NavLink href="/dashboard/analytics" icon={BarChart} label="Course Analytics" />
              <NavLink href="/dashboard/reports" icon={FileSpreadsheet} label="Section Reports" />
              <NavLink href="/dashboard/advanced-analytics" icon={BarChart} label="Advanced Analytics" />
              <NavLink href="/dashboard/marks" icon={Users} label="Marks Entry" />
              
              <div className="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Simulation</div>
              <NavLink href="/dashboard/what-if" icon={GraduationCap} label="What-If Scenarios" />

              {canManageAssessments || canAccessSections ? (
                <>
                  <div className="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</div>
                  {canManageAssessments ? <NavLink href="/dashboard/assessments" icon={Settings} label="Assessments" /> : null}
                  {canAccessSections ? <NavLink href="/dashboard/sections" icon={Users} label="Sections & Faculty" /> : null}
                </>
              ) : null}
            </>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex h-16 items-center justify-between border-b border-border/80 bg-background/78 px-6 backdrop-blur-xl">
          <div className="text-sm text-muted-foreground">
            {headerLabel}
          </div>
          <UserMenu
            name={user.name ?? "Account"}
            roleLabel={getRoleViewLabel(activeRoleView)}
            initials={user.firstName?.[0] || user.name?.[0] || "U"}
            signOutAction={signOutToLogin}
            changePasswordAction={changeOwnPassword}
          />
        </header>
        <div className="flex-1 overflow-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

function NavLink({ href, icon: Icon, label }: { href: string; icon: ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link 
      href={href}
      className="flex items-center rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Icon className="mr-3 h-5 w-5 text-primary/80" />
      {label}
    </Link>
  )
}
