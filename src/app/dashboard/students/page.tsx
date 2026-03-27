import { auth } from "@/auth"
import prisma from "@/lib/db"
import { getActiveWorkspaceState } from "@/lib/course-workspace"
import { redirect } from "next/navigation"
import { StudentsClient } from "./client"

export default async function StudentsPage() {
  const session = await auth()
  const user = session?.user

  if (!user) {
    redirect("/login")
  }
  if (!user.isAdmin) {
    redirect("/dashboard")
  }

  const { activeWorkspace, activeRoleView } = await getActiveWorkspaceState(user)
  const isElectiveUploadContext = activeRoleView !== "administrator" && Boolean(activeWorkspace.offeringId && activeWorkspace.isElective)

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
            ? `Upload, edit, and delete global student records while mapping this elective offering manually to the chosen class or section container.`
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
