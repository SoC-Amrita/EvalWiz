import { auth } from "@/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import prisma from "@/lib/db"
import { buildScopedSectionWhere, buildScopedStudentWhere, getActiveWorkspaceState, getRoleViewLabel, hasRealWorkspace } from "@/lib/course-workspace"
import { formatWorkspaceCode, formatWorkspaceRoleHeading } from "@/lib/workspace-labels"
import { BarChart3, BookOpen, Clock, Users } from "lucide-react"
import { DashboardTrendsChart } from "./trends-chart"
import { WorkspaceSelector } from "./workspace-selector"

type AuditLogDetails = {
  assessmentName?: string
  assessmentCode?: string
  successCount?: number
  userName?: string
}

export default async function DashboardOverview() {
  const session = await auth()
  const user = session?.user

  if (!user) return null

  const { workspaces, activeWorkspace, activeRoleView } = await getActiveWorkspaceState(user)
  const isAdministratorView = activeRoleView === "administrator"
  const hasWorkspace = hasRealWorkspace(activeWorkspace)
  const greetingName =
    user.firstName?.trim() ||
    user.name?.trim().split(/\s+/)[0] ||
    "there"

  if (isAdministratorView) {
    const [subjectCount, classCount, activeOfferingCount, userCount, activeMentorAssignments] = await Promise.all([
      prisma.subject.count(),
      prisma.section.count(),
      prisma.courseOffering.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.courseOfferingMentor.findMany({
        where: {
          offering: { isActive: true },
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
    ])
    const mentorCount = activeMentorAssignments.length

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            EvalWiz Admin Console
          </h1>
          <p className="text-slate-500">
            Keep administration global by default. Choose a course workspace only when you want to inspect offering-specific marks, analytics, reports, or section allocations.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Subjects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subjectCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Classes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Active Offerings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeOfferingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Mentors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mentorCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle>Subject Workspaces</CardTitle>
            <CardDescription>
              Subject-specific tools are intentionally hidden in admin console mode. Open the account menu in the top right whenever you want to switch back to normal subject workspaces.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="max-w-2xl text-sm text-slate-500">
              Use the admin console for global records and setup. When you want assessments, marks, analytics, reports, or section allocation for a course, switch modes from the account menu and the subject workspace picker will take over from there.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!hasWorkspace) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back, {greetingName}
          </h1>
          <p className="text-slate-500">
            Your course spaces will settle here as soon as an active offering is assigned to you. Once one opens up, you can step into it in the right role and pick up where you left off.
          </p>
        </div>

        <WorkspaceSelector
          workspaces={workspaces}
          activeCourseKey={activeWorkspace.key}
          activeRoleView={activeRoleView}
        />
      </div>
    )
  }

  const sectionWhere = await buildScopedSectionWhere(user, activeWorkspace, activeRoleView)
  const studentWhere = await buildScopedStudentWhere(user, activeWorkspace, activeRoleView)

  const [totalStudents, totalSections, totalAssessments, allMarks, assessments, recentLogs] = await Promise.all([
    prisma.student.count({
      where: studentWhere,
    }),
    prisma.section.count({
      where: sectionWhere,
    }),
    prisma.assessment.count({
      where: { isActive: true, offeringId: activeWorkspace.offeringId },
    }),
    prisma.mark.aggregate({
      _avg: { marks: true },
      where: {
        student: studentWhere,
        assessment: { offeringId: activeWorkspace.offeringId },
      },
    }),
    prisma.assessment.findMany({
      where: { isActive: true, offeringId: activeWorkspace.offeringId },
      include: {
        marks: {
          where: { student: studentWhere },
        },
      },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ])

  const chartData = assessments.map((assessment) => ({
    name: assessment.code,
    fullName: assessment.name,
    avg: assessment.marks.length > 0
      ? Number((assessment.marks.reduce((sum, mark) => sum + mark.marks, 0) / assessment.marks.length).toFixed(2))
      : 0,
    max: assessment.maxMarks,
    count: assessment.marks.length,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Welcome back, {greetingName}
        </h1>
        <p className="text-slate-500">
          Pick the course space you want to step into today, and I&apos;ll keep the rest of the system out of your way while you work there.
        </p>
      </div>

      <WorkspaceSelector
        workspaces={workspaces}
        activeCourseKey={activeWorkspace.key}
        activeRoleView={activeRoleView}
      />

      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {formatWorkspaceRoleHeading(getRoleViewLabel(activeRoleView), activeWorkspace)}
        </h2>
        <p className="text-slate-500">
          Stay focused on {formatWorkspaceCode(activeWorkspace)} while the top bar keeps the full course context visible.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Total Students</CardTitle>
            <Users className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-slate-500">
              Active students in this workspace
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Sections Visible</CardTitle>
            <BookOpen className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSections}</div>
            <p className="text-xs text-slate-500">
              {activeRoleView === "faculty" ? "Your assigned sections in this course" : "Sections in the selected course"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Active Assessments</CardTitle>
            <Clock className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssessments}</div>
            <p className="text-xs text-slate-500">
              Currently configured assessment components
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Avg. Component Score</CardTitle>
            <BarChart3 className="w-4 h-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allMarks._avg.marks ? Number(allMarks._avg.marks).toFixed(2) : "--"}
            </div>
            <p className="text-xs text-slate-500">
              Average mark inside the selected course
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-4">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
            <CardDescription>Average performance across assessment components for the selected course.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <DashboardTrendsChart data={chartData} />
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Portal Activity</CardTitle>
            <CardDescription>Latest marks entries and bulk updates across the portal.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No activity recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {recentLogs.map((log) => {
                  let details: AuditLogDetails = {}
                  try { details = JSON.parse(log.details) as AuditLogDetails } catch {}
                  const isBulk = log.action === "BULK_MARK_UPLOAD"
                  const label = isBulk
                    ? `Bulk upload: ${details.assessmentName ?? details.assessmentCode} (${details.successCount} records)`
                    : `Mark edited: ${details.assessmentName ?? details.assessmentCode}`
                  const who = details.userName ?? "Unknown"
                  const ts = new Date(log.createdAt)
                  const timeAgo = (() => {
                    const diff = Date.now() - ts.getTime()
                    const minutes = Math.floor(diff / 60000)
                    if (minutes < 1) return "just now"
                    if (minutes < 60) return `${minutes}m ago`
                    const hours = Math.floor(minutes / 60)
                    if (hours < 24) return `${hours}h ago`
                    return ts.toLocaleDateString()
                  })()
                  return (
                    <div key={log.id} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        isBulk ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700" : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                      }`}>
                        {isBulk ? "↑" : "✎"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{label}</p>
                        <p className="text-xs text-slate-500">{who} · {timeAgo}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
