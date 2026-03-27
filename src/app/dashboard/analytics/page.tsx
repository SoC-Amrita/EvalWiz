import { auth } from "@/auth"
import prisma from "@/lib/db"
import { buildScopedSectionWhere, getActiveWorkspaceState } from "@/lib/course-workspace"
import { redirect } from "next/navigation"
import { AnalyticsClient } from "./client"

export default async function AnalyticsPage() {
  const session = await auth()
  const user = session?.user
  if (!user) redirect("/login")

  const { activeWorkspace, activeRoleView } = await getActiveWorkspaceState(user)
  const sectionWhere = await buildScopedSectionWhere(user, activeWorkspace, activeRoleView)

  const assessments = await prisma.assessment.findMany({
    where: { isActive: true, offeringId: activeWorkspace.offeringId },
    orderBy: { displayOrder: "asc" }
  })

  // We need to fetch marks and aggregate them per assessment
  // For a large real app, we would do this in pure SQL or a background job.
  // For Prisma, we'll fetch averages directly using aggregate but we have to loop over assessments
  // or use groupBy.
  
  const componentStats = await Promise.all(
    assessments.map(async (a) => {
      const agg = await prisma.mark.aggregate({
        _avg: { marks: true },
        _max: { marks: true },
        _min: { marks: true },
        _count: { marks: true },
        where: {
          assessmentId: a.id,
          student: { section: sectionWhere }
        }
      })
      
      const countMissing = await prisma.student.count({
        where: {
          section: sectionWhere,
          marks: { none: { assessmentId: a.id } }
        }
      })

      // We handle Standard Deviation simply on the client or ignore for now,
      // as SQLite doesn't have a native STDDEV_SAMP without extension
      return {
        id: a.id,
        name: a.name,
        code: a.code,
        category: a.category,
        weightage: a.weightage,
        maxMarks: a.maxMarks,
        avg: agg._avg.marks ? Number(agg._avg.marks.toFixed(2)) : 0,
        max: agg._max.marks ?? 0,
        min: agg._min.marks ?? 0,
        countEntered: agg._count.marks,
        countMissing
      }
    })
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Course Analytics
        </h1>
        <p className="text-slate-500">
          Component-wise performance breakdown for {activeWorkspace.subjectCode} in the active workspace.
        </p>
      </div>

      <AnalyticsClient data={componentStats} />
    </div>
  )
}
