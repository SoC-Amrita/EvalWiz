"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, CheckCircle2, Shield, UserCog, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatWorkspaceCycleLabel, formatWorkspaceProgramSummary, hasRealWorkspace, getRoleViewLabel } from "@/lib/workspace-labels"
import { activateWorkspace } from "./workspace-actions"
import type { CourseWorkspace, WorkspaceRoleView } from "@/lib/course-workspace"

function roleIcon(roleView: WorkspaceRoleView) {
  switch (roleView) {
    case "administrator":
      return Shield
    case "mentor":
      return UserCog
    case "faculty":
      return Users
  }
}

export function WorkspaceSelector({
  workspaces,
  activeCourseKey,
  activeRoleView,
  variant = "default",
}: {
  workspaces: CourseWorkspace[]
  activeCourseKey: string
  activeRoleView: WorkspaceRoleView
  variant?: "default" | "admin"
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isAdminVariant = variant === "admin"

  const handleActivate = (courseKey: string, roleView: WorkspaceRoleView) => {
    startTransition(async () => {
      try {
        await activateWorkspace(courseKey, roleView)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to switch workspace")
      }
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {workspaces.map((workspace) => {
        const isActiveCourse = workspace.key === activeCourseKey
        const isSelectableWorkspace = hasRealWorkspace(workspace)
        return (
          <Card
            key={workspace.key}
            className={
              isAdminVariant
                ? `border-slate-200 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${isActiveCourse ? "border-primary/35 shadow-md" : ""}`
                : isActiveCourse
                  ? "border-primary/40 shadow-md"
                  : ""
            }
          >
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-primary">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                      {workspace.subjectCode}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {workspace.subjectTitle}
                  </h3>
                  {isSelectableWorkspace ? (
                    <p className="text-sm text-slate-500">
                      {formatWorkspaceCycleLabel(workspace)}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Create or activate an offering in Academic Setup, then return here to enter a course workspace.
                    </p>
                  )}
                  {isAdminVariant && isSelectableWorkspace ? (
                    <p className="text-xs text-slate-500">
                      Course tools stay scoped to this offering only after you explicitly enter one of the role views below.
                    </p>
                  ) : null}
                </div>
                {isActiveCourse && isSelectableWorkspace ? (
                  <Badge className="chip-soft-success">
                    Active
                  </Badge>
                ) : null}
              </div>

              {isSelectableWorkspace ? (
                <>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    <div>{formatWorkspaceProgramSummary(workspace)}</div>
                    <div className="mt-1">
                      {workspace.isElective
                        ? `Class: ${workspace.sectionNames[0] ?? "Elective class pending"}`
                        : `Sections: ${workspace.sectionCodes.length > 0 ? workspace.sectionCodes.join(", ") : "No sections yet"}`}
                    </div>
                    <div className="mt-1">
                      {workspace.courseType} · {workspace.evaluationPattern}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {workspace.availableRoleViews.map((roleView) => {
                      const Icon = roleIcon(roleView)
                      const isActiveRole = isActiveCourse && activeRoleView === roleView
                      const buttonLabel = isAdminVariant
                        ? `Open ${getRoleViewLabel(roleView)}`
                        : getRoleViewLabel(roleView)
                      return (
                        <Button
                          key={roleView}
                          variant={isActiveRole ? "default" : "outline"}
                          disabled={isPending}
                          onClick={() => handleActivate(workspace.key, roleView)}
                          className={isActiveRole ? "bg-primary text-primary-foreground" : ""}
                        >
                          {isActiveRole ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Icon className="h-4 w-4 mr-2" />}
                          {buttonLabel}
                        </Button>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
