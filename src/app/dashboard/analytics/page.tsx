import { auth } from "@/auth"
import { createEmptyMetricStats } from "@/lib/assessment-structure"
import prisma from "@/lib/db"
import { buildScopedStudentWhere, getActiveWorkspaceState } from "@/lib/course-workspace"
import { formatCompactSectionName, formatWorkspaceCode } from "@/lib/workspace-labels"
import { redirect } from "next/navigation"
import { AnalyticsClient } from "./client"

export default async function AnalyticsPage() {
  const session = await auth()
  const user = session?.user
  if (!user) redirect("/login")

  const { activeWorkspace, activeRoleView } = await getActiveWorkspaceState(user)
  const studentWhere = await buildScopedStudentWhere(user, activeWorkspace, activeRoleView, {
    excludeFromAnalytics: true,
  })

  const assessments = await prisma.assessment.findMany({
    where: { isActive: true, offeringId: activeWorkspace.offeringId },
    orderBy: { displayOrder: "asc" }
  })

  const scopedStudents = await prisma.student.findMany({
    where: studentWhere,
    select: {
      id: true,
      section: {
        select: {
          name: true,
          sectionCode: true,
        },
      },
    },
  })
  const assessmentIds = assessments.map((assessment) => assessment.id)
  const marks = assessmentIds.length === 0
    ? []
    : await prisma.mark.findMany({
        where: {
          assessmentId: { in: assessmentIds },
          student: studentWhere,
        },
        select: {
          assessmentId: true,
          marks: true,
          studentId: true,
        },
      })

  const marksByAssessmentId = new Map<
    string,
    {
      values: number[]
      studentIds: Set<string>
    }
  >()

  marks.forEach((mark) => {
    const current = marksByAssessmentId.get(mark.assessmentId)
    if (current) {
      current.values.push(mark.marks)
      current.studentIds.add(mark.studentId)
      return
    }

    marksByAssessmentId.set(mark.assessmentId, {
      values: [mark.marks],
      studentIds: new Set([mark.studentId]),
    })
  })

  const componentStats = assessments.map((assessment) => {
    const current = marksByAssessmentId.get(assessment.id)
    const values = current?.values ?? []
    const stats = values.length
      ? {
          avg: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
          max: Math.max(...values),
          min: Math.min(...values),
          countEntered: values.length,
        }
      : {
          ...createEmptyMetricStats(assessment.maxMarks),
          countEntered: 0,
        }

    const enteredStudentIds = current?.studentIds ?? new Set<string>()
    const missingSections = Array.from(
      scopedStudents.reduce((missingMap, student) => {
        if (!student.section || enteredStudentIds.has(student.id)) {
          return missingMap
        }

        const label = formatCompactSectionName(student.section.name, student.section.sectionCode)
        missingMap.set(label, (missingMap.get(label) ?? 0) + 1)
        return missingMap
      }, new Map<string, number>())
    )
      .map(([label, missingCount]) => ({ label, missingCount }))
      .sort((left, right) => left.label.localeCompare(right.label))

    return {
      id: assessment.id,
      name: assessment.name,
      code: assessment.code,
      category: assessment.category,
      weightage: assessment.weightage,
      maxMarks: assessment.maxMarks,
      avg: values.length ? stats.avg : 0,
      max: values.length ? stats.max : 0,
      min: values.length ? stats.min : 0,
      countEntered: values.length ? stats.countEntered : 0,
      countMissing: scopedStudents.length - enteredStudentIds.size,
      missingSections,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Course Analytics
        </h1>
        <p className="text-slate-500">
          Component trends and score patterns for {formatWorkspaceCode(activeWorkspace)}.
        </p>
      </div>

      <AnalyticsClient data={componentStats} />
    </div>
  )
}
