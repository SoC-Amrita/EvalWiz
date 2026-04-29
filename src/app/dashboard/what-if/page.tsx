import { getSessionUser } from "@/lib/session"
import prisma from "@/lib/db"
import { hasAnalysisPreviewAccess } from "@/lib/analysis-preview-access"
import { buildScopedSectionWhere, getActiveWorkspaceState } from "@/lib/course-workspace"
import { formatDetailedCompactSectionName, formatWorkspaceCode } from "@/lib/workspace-labels"
import { redirect } from "next/navigation"
import { WhatIfClient } from "./client"

export default async function WhatIfPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!(await hasAnalysisPreviewAccess())) redirect("/dashboard")

  const { activeWorkspace, activeRoleView } = await getActiveWorkspaceState(user)
  const sectionWhere = await buildScopedSectionWhere(user, activeWorkspace, activeRoleView)

  const [sections, assessments] = await Promise.all([
    prisma.section.findMany({
      where: sectionWhere,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        semester: true,
        programCode: true,
        sectionCode: true,
      },
    }),
    prisma.assessment.findMany({
      where: { isActive: true, offeringId: activeWorkspace.offeringId },
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        maxMarks: true,
        weightage: true,
        category: true,
      },
    }),
  ])

  const sectionIds = sections.map((section) => section.id)
  const assessmentIds = assessments.map((assessment) => assessment.id)
  const groupedStudents = new Map<
    string,
    Array<{
      id: string
      rollNo: string
      name: string
      marks: Record<string, number | null>
    }>
  >()

  if (sectionIds.length > 0) {
    if (activeWorkspace.isElective) {
      const enrollments = await prisma.courseOfferingEnrollment.findMany({
        where: {
          offeringId: activeWorkspace.offeringId,
          sectionId: { in: sectionIds },
          student: { excludeFromAnalytics: false },
        },
        include: {
          student: {
            select: {
              id: true,
              rollNo: true,
              name: true,
              marks: {
                where: { assessmentId: { in: assessmentIds } },
                select: {
                  assessmentId: true,
                  marks: true,
                },
              },
            },
          },
        },
        orderBy: [{ section: { name: "asc" } }, { student: { rollNo: "asc" } }],
      })

      for (const enrollment of enrollments) {
        const current = groupedStudents.get(enrollment.sectionId) ?? []
        current.push({
          id: enrollment.student.id,
          rollNo: enrollment.student.rollNo,
          name: enrollment.student.name,
          marks: Object.fromEntries(
            assessments.map((assessment) => [
              assessment.id,
              enrollment.student.marks.find((mark) => mark.assessmentId === assessment.id)?.marks ?? null,
            ])
          ),
        })
        groupedStudents.set(enrollment.sectionId, current)
      }
    } else {
      const students = await prisma.student.findMany({
        where: {
          sectionId: { in: sectionIds },
          excludeFromAnalytics: false,
        },
        select: {
          id: true,
          rollNo: true,
          name: true,
          sectionId: true,
          marks: {
            where: { assessmentId: { in: assessmentIds } },
            select: {
              assessmentId: true,
              marks: true,
            },
          },
        },
        orderBy: [{ section: { name: "asc" } }, { rollNo: "asc" }],
      })

      for (const student of students) {
        const current = groupedStudents.get(student.sectionId) ?? []
        current.push({
          id: student.id,
          rollNo: student.rollNo,
          name: student.name,
          marks: Object.fromEntries(
            assessments.map((assessment) => [
              assessment.id,
              student.marks.find((mark) => mark.assessmentId === assessment.id)?.marks ?? null,
            ])
          ),
        })
        groupedStudents.set(student.sectionId, current)
      }
    }
  }

  const sectionData = sections.map((section) => ({
    id: section.id,
    name: section.name,
    label: formatDetailedCompactSectionName(section),
    studentCount: (groupedStudents.get(section.id) ?? []).length,
    students: groupedStudents.get(section.id) ?? [],
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Scenario Analysis
        </h1>
        <p className="text-slate-500">
          {activeRoleView === "mentor"
            ? `Explore course-wide and section-level grade-shaping scenarios for ${formatWorkspaceCode(activeWorkspace)} without touching the live marks.`
            : `Explore class-level grade-shaping scenarios for ${formatWorkspaceCode(activeWorkspace)} without touching the live marks.`}
        </p>
      </div>

      <WhatIfClient
        sections={sectionData}
        assessments={assessments}
        roleView={activeRoleView}
        workspaceCode={formatWorkspaceCode(activeWorkspace)}
      />
    </div>
  )
}
