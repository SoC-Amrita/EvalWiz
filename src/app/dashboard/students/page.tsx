import { auth } from "@/auth"
import { classifyAssessment } from "@/lib/assessment-structure"
import prisma from "@/lib/db"
import { buildScopedSectionWhere, getActiveWorkspaceState, getRoleViewLabel } from "@/lib/course-workspace"
import { formatWorkspaceCode, formatWorkspaceRoleHeading } from "@/lib/workspace-labels"
import { redirect } from "next/navigation"
import { StudentsClient } from "./client"
import { getAdminStudentsPage, getWorkspaceStudentsPage } from "./queries"
import { WorkspaceStudentsClient } from "./workspace-students-client"

type StudentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key]
  return Array.isArray(value) ? value[0] : value
}

function readPageParam(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const session = await auth()
  const user = session?.user

  if (!user) {
    redirect("/login")
  }

  const { activeWorkspace, activeRoleView } = await getActiveWorkspaceState(user)
  const isElectiveUploadContext = activeRoleView !== "administrator" && Boolean(activeWorkspace.offeringId && activeWorkspace.isElective)
  const resolvedSearchParams = (await searchParams) ?? {}
  const query = readSingleSearchParam(resolvedSearchParams, "q")?.trim() ?? ""
  const page = readPageParam(readSingleSearchParam(resolvedSearchParams, "page"))
  const requestedSectionId = readSingleSearchParam(resolvedSearchParams, "section")?.trim() ?? ""

  if (activeRoleView !== "administrator") {
    if (!activeWorkspace.offeringId) {
      redirect("/dashboard")
    }

    const assessments = await prisma.assessment.findMany({
      where: { isActive: true, offeringId: activeWorkspace.offeringId },
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        maxMarks: true,
        category: true,
      },
    })

    const assessmentIds = assessments.map((assessment) => assessment.id)

    const [studentPage, scopedSections] = await Promise.all([
      getWorkspaceStudentsPage({
        user,
        workspace: activeWorkspace,
        roleView: activeRoleView,
        query,
        page,
        sectionId: requestedSectionId && requestedSectionId !== "ALL" ? requestedSectionId : null,
        assessmentIds,
      }),
      prisma.section.findMany({
        where: await buildScopedSectionWhere(user, activeWorkspace, activeRoleView),
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          semester: true,
          programCode: true,
          sectionCode: true,
        },
      }),
    ])
    const pendingDeletionRequests = await prisma.studentDeletionRequest.findMany({
      where: {
        status: "PENDING",
        studentId: {
          in: studentPage.students.map((student) => student.id),
        },
      },
      select: {
        studentId: true,
      },
    })

    return (
      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {activeRoleView === "faculty" ? "Class Students" : "Course Students"}
        </h1>
        <p className="text-slate-500">
          {activeRoleView === "faculty"
            ? `Review the student roster for your assigned class in ${formatWorkspaceCode(activeWorkspace)}.`
            : `${formatWorkspaceRoleHeading(getRoleViewLabel(activeRoleView), activeWorkspace)}. Use the section filter to focus on one class at a time.`}
        </p>
      </div>

        <WorkspaceStudentsClient
          initialData={studentPage.students}
          sections={scopedSections}
          assessments={assessments.map((assessment) => ({
            ...assessment,
            classification: classifyAssessment(assessment),
          }))}
          roleView={activeRoleView}
          searchQuery={query}
          currentPage={studentPage.page}
          pageCount={studentPage.pageCount}
          totalCount={studentPage.totalCount}
          selectedSectionId={requestedSectionId && requestedSectionId !== "ALL" ? requestedSectionId : "ALL"}
          pendingDeletionStudentIds={pendingDeletionRequests
            .map((request) => request.studentId)
            .filter((studentId): studentId is string => Boolean(studentId))}
        />
      </div>
    )
  }

  const [studentPage, sections, pendingDeletionRequests, archivedStudents] = await Promise.all([
    getAdminStudentsPage({
      query,
      page,
    }),
    prisma.section.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.studentDeletionRequest.findMany({
      where: {
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        studentId: true,
        studentRollNo: true,
        studentName: true,
        sectionName: true,
        requestedByName: true,
        requestedByUserId: true,
        reason: true,
        createdAt: true,
      },
    }),
    prisma.archivedStudent.findMany({
      where: {
        restoredAt: null,
      },
      orderBy: { archivedAt: "desc" },
      select: {
        id: true,
        rollNo: true,
        name: true,
        sectionName: true,
        archivedAt: true,
        archiveReason: true,
      },
      take: 100,
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Student Master List
        </h1>
        <p className="text-slate-500">
          {isElectiveUploadContext
            ? `Upload, edit, and delete global student records while placing this elective roster into its single dedicated class.`
            : `Upload, edit, and delete global student records. Regular roll numbers auto-map students into their lifetime home classes, and manual override happens inside each student record when an admin changes class assignment.`}
        </p>
      </div>

      <StudentsClient
        initialData={studentPage.students}
        sections={sections}
        canManageAllSections
        isElectiveOffering={isElectiveUploadContext}
        searchQuery={query}
        currentPage={studentPage.page}
        pageCount={studentPage.pageCount}
        totalCount={studentPage.totalCount}
        pendingDeletionRequests={pendingDeletionRequests}
        archivedStudents={archivedStudents}
      />
    </div>
  )
}
