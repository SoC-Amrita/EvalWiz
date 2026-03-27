import { auth } from "@/auth"
import prisma from "@/lib/db"
import { buildScopedSectionWhere, buildScopedStudentWhere, getActiveWorkspaceState, getRoleViewLabel } from "@/lib/course-workspace"
import { formatWorkspaceFullLabel } from "@/lib/workspace-labels"
import { redirect } from "next/navigation"
import { StudentsClient } from "./client"
import { WorkspaceStudentsClient } from "./workspace-students-client"

export default async function StudentsPage() {
  const session = await auth()
  const user = session?.user

  if (!user) {
    redirect("/login")
  }

  const { activeWorkspace, activeRoleView } = await getActiveWorkspaceState(user)
  const isElectiveUploadContext = activeRoleView !== "administrator" && Boolean(activeWorkspace.offeringId && activeWorkspace.isElective)

  if (activeRoleView !== "administrator") {
    if (!activeWorkspace.offeringId) {
      redirect("/dashboard")
    }

    const [students, sections] = await Promise.all([
      prisma.student.findMany({
        where: await buildScopedStudentWhere(user, activeWorkspace, activeRoleView),
        include: {
          section: {
            select: {
              id: true,
              name: true,
              semester: true,
              programCode: true,
              sectionCode: true,
            },
          },
        },
        orderBy: [{ section: { name: "asc" } }, { rollNo: "asc" }],
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

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {activeRoleView === "faculty" ? "Class Students" : "Course Students"}
          </h1>
          <p className="text-slate-500">
            {activeRoleView === "faculty"
              ? `Review the student roster for your assigned class in ${formatWorkspaceFullLabel(activeWorkspace)}.`
              : `${getRoleViewLabel(activeRoleView)} view for ${formatWorkspaceFullLabel(activeWorkspace)}. Use the section filter to focus on one class at a time.`}
          </p>
        </div>

        <WorkspaceStudentsClient
          initialData={students}
          sections={sections}
          roleView={activeRoleView}
        />
      </div>
    )
  }

  const [students, sections] = await Promise.all([
    prisma.student.findMany({
      include: {
        section: true,
      },
      orderBy: [{ section: { name: "asc" } }, { rollNo: "asc" }]
    }),
    prisma.section.findMany({
      orderBy: { name: "asc" },
    })
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
        initialData={students}
        sections={sections}
        canManageAllSections
        isElectiveOffering={isElectiveUploadContext}
      />
    </div>
  )
}
