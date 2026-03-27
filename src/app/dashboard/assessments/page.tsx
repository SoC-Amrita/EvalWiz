import { auth } from "@/auth"
import prisma from "@/lib/db"
import { getActiveWorkspaceState } from "@/lib/course-workspace"
import { redirect } from "next/navigation"
import { AssessmentClient } from "./client"

export default async function AssessmentsPage() {
  const session = await auth()
  const user = session?.user

  if (!user) {
    redirect("/dashboard")
  }

  const { activeWorkspace, activeRoleView } = await getActiveWorkspaceState(user)
  if (activeRoleView === "faculty") {
    redirect("/dashboard")
  }

  const assessments = await prisma.assessment.findMany({
    where: { offeringId: activeWorkspace.offeringId },
    orderBy: { displayOrder: "asc" }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Assessment Components
        </h1>
        <p className="text-slate-500">
          Manage the assessment structure for {activeWorkspace.subjectCode} in the active workspace.
        </p>
      </div>

      <AssessmentClient data={assessments} />
    </div>
  )
}
