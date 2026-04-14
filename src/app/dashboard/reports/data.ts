import { APP_INFO } from "@/lib/app-info"
import {
  buildWeightedStudentTotals,
  computeMetricStats,
  getAssessmentWeightConfig,
  type AssessmentLike,
  type ReportMetricKey,
} from "@/lib/assessment-structure"
import { buildScopedSectionWhere, buildScopedStudentWhere } from "@/lib/course-workspace"
import prisma from "@/lib/db"
import { requireAuthenticatedWorkspaceState, requireRealWorkspace } from "@/lib/workspace-guards"
import { formatDetailedCompactSectionName } from "@/lib/workspace-labels"

import type {
  AssessmentComponentReport,
  FinalMarkStemPoint,
  ReportMeta,
  SectionReportData,
} from "./types"

type ReportAssessment = AssessmentLike & {
  id: string
}

type RawReportStudent = {
  id: string
  sectionId: string
  rollNo: string | null
  name: string | null
}

type RawReportMark = {
  studentId: string
  assessmentId: string
  marks: number
}

type ReportSection = {
  id: string
  name: string
  semester: string | null
  programCode: string | null
  sectionCode: string | null
}

type ReportStudentEntry = {
  studentId: string
  rollNo: string | null
  name: string | null
}

type SectionSummary = {
  sectionId: string
  sectionName: string
  facultyName: string | null
  studentRecords: Array<{
    id: string
    rollNo: string
    name: string
  }>
  studentMarks: Array<Array<{
    assessmentId: string
    marks: number
    assessment: ReportAssessment
  }>>
}

type ReportWorkspaceDataset = {
  activeRoleView: "administrator" | "mentor" | "faculty"
  activeWorkspace: Awaited<ReturnType<typeof requireAuthenticatedWorkspaceState>>["activeWorkspace"]
  assessments: ReportAssessment[]
  sections: ReportSection[]
  mentorNameList: string[]
  courseTeamNames: string[]
  sectionSummaries: SectionSummary[]
}

function buildSectionSummaryRows(
  sections: ReportSection[],
  facultyBySectionId: Map<string, string>,
  studentsBySectionId: Map<string, ReportStudentEntry[]>,
  marksByStudentId: Map<string, RawReportMark[]>,
  assessmentsById: Map<string, ReportAssessment>
) {
  return sections.map((section) => {
    const studentEntries = studentsBySectionId.get(section.id) ?? []

    return {
      sectionId: section.id,
      sectionName: formatDetailedCompactSectionName(section),
      facultyName: facultyBySectionId.get(section.id) ?? "Unassigned",
      studentRecords: studentEntries.map((student) => ({
        id: student.studentId,
        rollNo: student.rollNo ?? "—",
        name: student.name ?? "Student",
      })),
      studentMarks: studentEntries.map((student) =>
        (marksByStudentId.get(student.studentId) ?? [])
          .map((mark) => {
            const assessment = assessmentsById.get(mark.assessmentId)
            return assessment
              ? {
                  assessmentId: mark.assessmentId,
                  marks: mark.marks,
                  assessment,
                }
              : null
          })
          .filter(
            (
              mark
            ): mark is {
              assessmentId: string
              marks: number
              assessment: ReportAssessment
            } => Boolean(mark)
          )
      ),
    }
  })
}

function buildReportRow(
  studentMarks: SectionSummary["studentMarks"],
  weightConfig: ReturnType<typeof getAssessmentWeightConfig>,
  info: Pick<SectionSummary, "sectionId" | "sectionName" | "facultyName">
): SectionReportData {
  const studentMetrics = studentMarks.map((marks) => buildWeightedStudentTotals(marks))

  const computeAgg = (key: ReportMetricKey) =>
    computeMetricStats(
      studentMetrics.map((student) => student[key]),
      weightConfig[key]
    )

  return {
    sectionId: info.sectionId,
    sectionName: info.sectionName,
    facultyName: info.facultyName,
    totalStudents: studentMetrics.length,
    quiz: computeAgg("quiz"),
    review: computeAgg("review"),
    ca: computeAgg("ca"),
    midTerm: computeAgg("midTerm"),
    caMidTerm: computeAgg("caMidTerm"),
    endSemester: computeAgg("endSemester"),
    overall: computeAgg("overall"),
  }
}

function buildComponentStats(input: {
  sectionId: string
  sectionName: string
  studentMarks: Array<Array<{ assessmentId: string; marks: number }>>
  assessmentId: string
  maxMarks: number
}) {
  return {
    sectionId: input.sectionId,
    sectionName: input.sectionName,
    totalStudents: input.studentMarks.length,
    stats: computeMetricStats(
      input.studentMarks
        .map((marks) => marks.find((mark) => mark.assessmentId === input.assessmentId)?.marks)
        .filter((mark): mark is number => typeof mark === "number"),
      input.maxMarks
    ),
  }
}

async function loadReportWorkspaceDataset(options?: {
  includeStudentIdentity?: boolean
}): Promise<ReportWorkspaceDataset> {
  const { user, activeWorkspace, activeRoleView } = await requireAuthenticatedWorkspaceState()
  requireRealWorkspace(activeWorkspace)

  const sectionFilter = await buildScopedSectionWhere(user, activeWorkspace, activeRoleView)
  const studentFilter = await buildScopedStudentWhere(user, activeWorkspace, activeRoleView, {
    excludeFromAnalytics: true,
  })

  const [assessments, sections, mentorAssignments, classAssignments] = await Promise.all([
    prisma.assessment.findMany({
      where: { isActive: true, offeringId: activeWorkspace.offeringId },
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        weightage: true,
        maxMarks: true,
      },
    }),
    prisma.section.findMany({
      where: sectionFilter,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        semester: true,
        programCode: true,
        sectionCode: true,
      },
    }),
    prisma.courseOfferingMentor.findMany({
      where: { offeringId: activeWorkspace.offeringId },
      orderBy: { user: { name: "asc" } },
      select: {
        user: {
          select: { name: true },
        },
      },
    }),
    prisma.courseOfferingClass.findMany({
      where: { offeringId: activeWorkspace.offeringId },
      select: {
        sectionId: true,
        faculty: {
          select: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    }),
  ])

  const mentorNameList = mentorAssignments
    .map((mentor) => mentor.user.name)
    .filter((name): name is string => Boolean(name))

  const seenCourseTeamNames = new Set<string>()
  const courseTeamNames = classAssignments
    .map((assignment) => assignment.faculty?.user.name)
    .filter((name): name is string => Boolean(name))
    .filter((name) => {
      if (seenCourseTeamNames.has(name)) return false
      seenCourseTeamNames.add(name)
      return true
    })

  const facultyBySectionId = new Map(
    classAssignments.map((assignment) => [assignment.sectionId, assignment.faculty?.user.name ?? "Unassigned"])
  )

  const studentEntries: RawReportStudent[] = activeWorkspace.isElective
    ? await prisma.courseOfferingEnrollment.findMany({
        where: {
          offeringId: activeWorkspace.offeringId,
          student: studentFilter,
        },
        orderBy: [
          { section: { name: "asc" } },
          { student: { rollNo: "asc" } },
        ],
        select: {
          sectionId: true,
          student: {
            select: {
              id: true,
              rollNo: options?.includeStudentIdentity ? true : false,
              name: options?.includeStudentIdentity ? true : false,
            },
          },
        },
      }).then((enrollments) =>
        enrollments.map((enrollment) => ({
          id: enrollment.student.id,
          sectionId: enrollment.sectionId,
          rollNo:
            "rollNo" in enrollment.student && typeof enrollment.student.rollNo === "string"
              ? enrollment.student.rollNo
              : null,
          name:
            "name" in enrollment.student && typeof enrollment.student.name === "string"
              ? enrollment.student.name
              : null,
        }))
      )
    : await prisma.student.findMany({
        where: studentFilter,
        orderBy: [{ section: { name: "asc" } }, { rollNo: "asc" }],
        select: {
          id: true,
          sectionId: true,
          rollNo: options?.includeStudentIdentity ?? false,
          name: options?.includeStudentIdentity ?? false,
        },
      }).then((students) =>
        students.map((student) => ({
          id: student.id,
          sectionId: student.sectionId,
          rollNo: "rollNo" in student && typeof student.rollNo === "string" ? student.rollNo : null,
          name: "name" in student && typeof student.name === "string" ? student.name : null,
        }))
      )

  const scopedStudentIds = studentEntries.map((student) => student.id)
  const assessmentIds = assessments.map((assessment) => assessment.id)
  const rawMarks = scopedStudentIds.length === 0 || assessmentIds.length === 0
    ? []
    : await prisma.mark.findMany({
        where: {
          studentId: { in: scopedStudentIds },
          assessmentId: { in: assessmentIds },
        },
        select: {
          studentId: true,
          assessmentId: true,
          marks: true,
        },
      })

  const assessmentsById = new Map(assessments.map((assessment) => [assessment.id, assessment]))
  const marksByStudentId = new Map<string, RawReportMark[]>()
  rawMarks.forEach((mark) => {
    const existing = marksByStudentId.get(mark.studentId)
    if (existing) {
      existing.push(mark)
    } else {
      marksByStudentId.set(mark.studentId, [mark])
    }
  })

  const studentsBySectionId = new Map<string, ReportStudentEntry[]>()
  studentEntries.forEach((student) => {
    const existing = studentsBySectionId.get(student.sectionId)
    const entry = {
      studentId: student.id,
      rollNo: student.rollNo,
      name: student.name,
    }

    if (existing) {
      existing.push(entry)
    } else {
      studentsBySectionId.set(student.sectionId, [entry])
    }
  })

  return {
    activeRoleView,
    activeWorkspace,
    assessments,
    sections,
    mentorNameList,
    courseTeamNames,
    sectionSummaries: buildSectionSummaryRows(
      sections,
      facultyBySectionId,
      studentsBySectionId,
      marksByStudentId,
      assessmentsById
    ),
  }
}

export async function getReportsSummaryData() {
  const {
    activeRoleView,
    activeWorkspace,
    assessments,
    sections,
    mentorNameList,
    courseTeamNames,
    sectionSummaries,
  } = await loadReportWorkspaceDataset()

  const weightConfig = getAssessmentWeightConfig(assessments)
  const reportData = sectionSummaries.map((summary) =>
    buildReportRow(summary.studentMarks, weightConfig, summary)
  )
  const isCourseView = activeRoleView !== "faculty" && sections.length > 1

  const courseAggregate = isCourseView
    ? buildReportRow(
        sectionSummaries.flatMap((summary) => summary.studentMarks),
        weightConfig,
        {
          sectionId: "ALL",
          sectionName: "Entire Course",
          facultyName: "All Faculty",
        }
      )
    : null

  const reportMeta: ReportMeta = {
    appName: APP_INFO.name,
    school: "School of Computing",
    department: "Department of Computer Science and Engineering",
    institution: "Amrita Vishwa Vidyapeetham, Coimbatore",
    subjectCode: activeWorkspace.subjectCode,
    subjectTitle: activeWorkspace.subjectTitle,
    academicYear: activeWorkspace.academicYear,
    term: activeWorkspace.term,
    semester: activeWorkspace.semester,
    year: activeWorkspace.year,
    course: activeWorkspace.program,
    courseType: activeWorkspace.courseType,
    evaluationPattern: activeWorkspace.evaluationPattern,
    developer: APP_INFO.developer,
    mentorNames: mentorNameList,
    courseTeamNames,
  }

  return {
    reportData,
    courseAggregate,
    reportMeta,
  }
}

export async function getReportsDetailData() {
  const {
    activeRoleView,
    assessments,
    sections,
    sectionSummaries,
  } = await loadReportWorkspaceDataset({
    includeStudentIdentity: true,
  })

  const weightConfig = getAssessmentWeightConfig(assessments)
  const isCourseView = activeRoleView !== "faculty" && sections.length > 1

  const componentReports: AssessmentComponentReport[] = assessments.map((assessment) => {
    const rows = sectionSummaries.map((summary) =>
      buildComponentStats({
        sectionId: summary.sectionId,
        sectionName: summary.sectionName,
        studentMarks: summary.studentMarks.map((marks) =>
          marks.map((mark) => ({
            assessmentId: mark.assessmentId,
            marks: mark.marks,
          }))
        ),
        assessmentId: assessment.id,
        maxMarks: assessment.maxMarks,
      })
    )

    if (isCourseView) {
      rows.push(
        buildComponentStats({
          sectionId: "ALL",
          sectionName: "Entire Course",
          studentMarks: sectionSummaries.flatMap((summary) =>
            summary.studentMarks.map((marks) =>
              marks.map((mark) => ({
                assessmentId: mark.assessmentId,
                marks: mark.marks,
              }))
            )
          ),
          assessmentId: assessment.id,
          maxMarks: assessment.maxMarks,
        })
      )
    }

    return {
      assessmentId: assessment.id,
      assessmentCode: assessment.code,
      assessmentName: assessment.name,
      assessmentCategory: assessment.category,
      maxMarks: assessment.maxMarks,
      rows,
    }
  })

  const finalMarkStemData: FinalMarkStemPoint[] = sectionSummaries.flatMap((summary) =>
    summary.studentMarks.map((marks, index) => {
      const student = summary.studentRecords[index]
      const totals = buildWeightedStudentTotals(marks)

      return {
        studentId: student?.id ?? `${summary.sectionId}-${index}`,
        rollNo: student?.rollNo ?? "—",
        studentName: student?.name ?? "Student",
        sectionId: summary.sectionId,
        sectionName: summary.sectionName,
        score: Number(totals.overall.toFixed(2)),
        outOf: weightConfig.overall,
      }
    })
  )

  return {
    componentReports,
    finalMarkStemData,
  }
}
