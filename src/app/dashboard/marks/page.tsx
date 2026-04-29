import { getSessionUser } from "@/lib/session"
import prisma from "@/lib/db"
import { buildScopedSectionWhere, getActiveWorkspaceState } from "@/lib/course-workspace"
import { redirect } from "next/navigation"
import { MarksClient } from "./client"

export default async function MarksPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const { activeWorkspace, activeRoleView } = await getActiveWorkspaceState(user)
  const sectionWhere = await buildScopedSectionWhere(user, activeWorkspace, activeRoleView)

  const sections = await prisma.section.findMany({
    where: sectionWhere,
    orderBy: { name: "asc" }
  })

  const assessments = await prisma.assessment.findMany({
    where: { isActive: true, offeringId: activeWorkspace.offeringId },
    orderBy: { displayOrder: "asc" }
  })

  // To avoid fetching all marks globally, the client will trigger a targeted fetch
  // or we can pre-render the active selections via searchParams if we wanted SSR.
  // For a SPA-like feel, we'll pass the structural data and fetch students/marks
  // inside a client wrapper or via a server action when section is selected.
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Marks Entry & Assessment
        </h1>
        <p className="text-slate-500">
          Choose one section and one component to enter, upload, or export marks.
        </p>
      </div>

      <MarksClient sections={sections} assessments={assessments} />
    </div>
  )
}
