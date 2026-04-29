import { getSessionUser } from "@/lib/session"
import { createEmptyMetricStats } from "@/lib/assessment-structure"
import prisma from "@/lib/db"
import { buildScopedStudentWhere, getActiveWorkspaceState } from "@/lib/course-workspace"
import { formatCompactSectionName, formatWorkspaceCode } from "@/lib/workspace-labels"
import { redirect } from "next/navigation"

import { loadAdvancedAnalyticsDetailData } from "../advanced-analytics/actions"
import { getAdvancedAnalyticsSummaryData } from "../advanced-analytics/data"
import { loadReportsDetailData } from "../reports/actions"
import { getReportsSummaryData } from "../reports/data"
import { AnalyticsWorkspaceShell, type AnalyticsWorkspaceTab } from "./workspace-shell"

type AnalyticsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key]
  return Array.isArray(value) ? value[0] : value
}

function readAnalyticsTab(value: string | undefined): AnalyticsWorkspaceTab {
  if (value === "advanced" || value === "reports") {
    return value
  }

  return "course"
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const { activeWorkspace, activeRoleView } = await getActiveWorkspaceState(user)
  const resolvedSearchParams = (await searchParams) ?? {}
  const activeTab = readAnalyticsTab(readSingleSearchParam(resolvedSearchParams, "tab"))
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

  const [{ reportData, courseAggregate, reportMeta }, advancedSummary] = await Promise.all([
    getReportsSummaryData(),
    getAdvancedAnalyticsSummaryData(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Course Analytics
        </h1>
        <p className="text-slate-500">
          Overview, advanced charts, and section reports for {formatWorkspaceCode(activeWorkspace)}.
        </p>
      </div>

      <AnalyticsWorkspaceShell
        initialTab={activeTab}
        componentStats={componentStats}
        advancedSummary={advancedSummary}
        reportData={reportData}
        courseAggregate={courseAggregate}
        reportMeta={reportMeta}
        loadAdvancedDetailsAction={loadAdvancedAnalyticsDetailData}
        loadReportDetailsAction={loadReportsDetailData}
      />
    </div>
  )
}
