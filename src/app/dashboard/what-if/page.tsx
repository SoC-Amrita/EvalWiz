import { auth } from "@/auth"
import prisma from "@/lib/db"
import { buildScopedSectionWhere, getActiveWorkspaceState } from "@/lib/course-workspace"
import { formatWorkspaceFullLabel } from "@/lib/workspace-labels"
import { redirect } from "next/navigation"
import { WhatIfClient } from "./client"

export default async function WhatIfPage() {
  const session = await auth()
  const user = session?.user
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          What-If Simulation Engine
        </h1>
        <p className="text-slate-500">
          {formatWorkspaceFullLabel(activeWorkspace)}
        </p>
      </div>

      <WhatIfClient sections={sections} assessments={assessments} />
    </div>
  )
}
