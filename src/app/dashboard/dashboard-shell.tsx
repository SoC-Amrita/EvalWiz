"use client"

import Link from "next/link"
import { useEffect, useState, type ComponentType, type ReactNode } from "react"
import {
  BarChart,
  BookOpen,
  FileSpreadsheet,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from "lucide-react"

import { APP_INFO } from "@/lib/app-info"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { AdminModeSwitchButton } from "./admin-mode-switch-button"
import { UserMenu } from "./user-menu"
import {
  AnalysisPreviewDialog,
  CONTEXT_BEACON_PRIMARY,
  CONTEXT_BEACON_SECONDARY,
  WorkspaceContextBeacon,
} from "./workspace-context-gate"

const SIDEBAR_STORAGE_KEY = "evalwiz:dashboard-sidebar-open"

type DashboardShellProps = {
  isAdmin: boolean
  hasWorkspace: boolean
  activeRoleLabel: string
  sidebarSubtitle: string
  headerLabel: string
  userIsAdmin: boolean
  canManageAssessments: boolean
  canAccessSections: boolean
  userName: string
  userInitials: string
  showAnalysisPreview: boolean
  signOutAction: () => Promise<void>
  changePasswordAction: (formData: FormData) => Promise<{ success: boolean }>
  children: ReactNode
}

export function DashboardShell({
  isAdmin,
  hasWorkspace,
  activeRoleLabel,
  sidebarSubtitle,
  headerLabel,
  userIsAdmin,
  canManageAssessments,
  canAccessSections,
  userName,
  userInitials,
  showAnalysisPreview,
  signOutAction,
  changePasswordAction,
  children,
}: DashboardShellProps) {
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    if (typeof window === "undefined") {
      return true
    }

    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "0"
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, desktopSidebarOpen ? "1" : "0")
  }, [desktopSidebarOpen])

  const SidebarContents = (
    <SidebarNavigation
      isAdmin={isAdmin}
      hasWorkspace={hasWorkspace}
      sidebarSubtitle={sidebarSubtitle}
      userIsAdmin={userIsAdmin}
      canManageAssessments={canManageAssessments}
      canAccessSections={canAccessSections}
      onNavigate={() => setMobileSidebarOpen(false)}
    />
  )

  return (
    <div className="relative flex min-h-screen overflow-hidden app-shell">
      <div className="pointer-events-none absolute inset-0 app-grid opacity-60" />

      {desktopSidebarOpen ? (
        <aside className="relative z-10 hidden w-64 flex-col border-r border-border/80 bg-background/85 backdrop-blur-xl md:flex">
          {SidebarContents}
        </aside>
      ) : null}

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-xs p-0" showCloseButton>
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Open and switch dashboard sections.</SheetDescription>
          </SheetHeader>
          {SidebarContents}
        </SheetContent>
      </Sheet>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex h-16 items-center justify-between border-b border-border/80 bg-background/78 px-4 backdrop-blur-xl md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="hidden md:inline-flex"
              onClick={() => setDesktopSidebarOpen((current) => !current)}
            >
              {desktopSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
              <span className="sr-only">
                {desktopSidebarOpen ? "Hide sidebar" : "Show sidebar"}
              </span>
            </Button>
            {hasWorkspace && !isAdmin ? (
              <WorkspaceContextBeacon
                step={CONTEXT_BEACON_SECONDARY}
                className="max-w-[68vw] truncate text-left text-xs text-muted-foreground md:max-w-[70vw] md:text-sm"
              >
                {headerLabel}
              </WorkspaceContextBeacon>
            ) : (
              <div className="max-w-[68vw] truncate text-xs text-muted-foreground md:max-w-[70vw] md:text-sm">
                {headerLabel}
              </div>
            )}
          </div>
          <UserMenu
            name={userName}
            roleLabel={activeRoleLabel}
            initials={userInitials}
            signOutAction={signOutAction}
            changePasswordAction={changePasswordAction}
          />
        </header>
        <div className="flex-1 overflow-auto p-6 md:p-8">
          {showAnalysisPreview ? <AnalysisPreviewDialog /> : null}
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

function SidebarNavigation({
  isAdmin,
  hasWorkspace,
  sidebarSubtitle,
  userIsAdmin,
  canManageAssessments,
  canAccessSections,
  onNavigate,
}: {
  isAdmin: boolean
  hasWorkspace: boolean
  sidebarSubtitle: string
  userIsAdmin: boolean
  canManageAssessments: boolean
  canAccessSections: boolean
  onNavigate: () => void
}) {
  return (
    <>
      <div className="border-b border-border/80 p-6">
        {hasWorkspace && !isAdmin ? (
          <WorkspaceContextBeacon
            step={CONTEXT_BEACON_PRIMARY}
            className="flex w-full items-center space-x-3 rounded-xl text-left transition hover:bg-accent/30"
          >
            <div className="rounded-lg bg-primary/12 p-2 text-primary ring-1 ring-primary/15">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-lg font-semibold tracking-tight text-foreground">{APP_INFO.name}</span>
              <p className="text-xs text-muted-foreground">{sidebarSubtitle}</p>
              {isAdmin ? (
                <p className="mt-1 text-[11px] text-muted-foreground/80">
                  Course-specific tools only apply after you explicitly select a workspace.
                </p>
              ) : null}
            </div>
          </WorkspaceContextBeacon>
        ) : (
          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-primary/12 p-2 text-primary ring-1 ring-primary/15">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-lg font-semibold tracking-tight text-foreground">{APP_INFO.name}</span>
              <p className="text-xs text-muted-foreground">{sidebarSubtitle}</p>
              {isAdmin ? (
                <p className="mt-1 text-[11px] text-muted-foreground/80">
                  Course-specific tools only apply after you explicitly select a workspace.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-3">
        {isAdmin ? (
          <AdminModeSwitchButton targetMode="workspace" />
        ) : userIsAdmin ? (
          <AdminModeSwitchButton targetMode="admin" />
        ) : (
          <Link href="/dashboard" className="text-xs font-medium text-primary hover:underline" onClick={onNavigate}>
            Switch Workspace
          </Link>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
        <div className="mb-2 mt-4 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overview</div>
        <NavLink href="/dashboard" icon={BarChart} label={isAdmin ? "Admin Console" : "Workspace Home"} onNavigate={onNavigate} />

        {isAdmin ? (
          <>
            <div className="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Administration</div>
            <NavLink href="/dashboard/academic-setup" icon={Settings} label="Academic Setup" onNavigate={onNavigate} />
            <NavLink href="/dashboard/students" icon={Users} label="Student Master List" onNavigate={onNavigate} />
            <NavLink href="/dashboard/users" icon={Users} label="User Admin" onNavigate={onNavigate} />
          </>
        ) : (
          <>
            <NavLink href="/dashboard/analytics" icon={BarChart} label="Course Analytics" onNavigate={onNavigate} />
            <NavLink href="/dashboard/students" icon={Users} label="Students" onNavigate={onNavigate} />
            <NavLink href="/dashboard/reports" icon={FileSpreadsheet} label="Section Reports" onNavigate={onNavigate} />
            <NavLink href="/dashboard/advanced-analytics" icon={BarChart} label="Advanced Analytics" onNavigate={onNavigate} />
            <NavLink href="/dashboard/marks" icon={Users} label="Marks Entry" onNavigate={onNavigate} />

            {canManageAssessments || canAccessSections ? (
              <>
                <div className="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</div>
                {canManageAssessments ? (
                  <NavLink href="/dashboard/assessments" icon={Settings} label="Assessments" onNavigate={onNavigate} />
                ) : null}
                {canAccessSections ? (
                  <NavLink href="/dashboard/sections" icon={Users} label="Section Allocation" onNavigate={onNavigate} />
                ) : null}
              </>
            ) : null}
          </>
        )}
      </nav>
    </>
  )
}

function NavLink({
  href,
  icon: Icon,
  label,
  onNavigate,
}: {
  href: string
  icon: ComponentType<{ className?: string }>
  label: string
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Icon className="mr-3 h-5 w-5 text-primary/80" />
      {label}
    </Link>
  )
}
