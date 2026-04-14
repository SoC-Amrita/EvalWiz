import { APP_INFO } from "@/lib/app-info"
import {
  buildWeightedStudentTotals,
  computeMetricStats,
  getAssessmentWeightConfig,
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
    assessment: {
      code: string
      name: string
      category: string
      weightage: number
      maxMarks: number
    }
  }>>
}

async function loadReportsWorkspaceData() {
  const { user, activeWorkspace, activeRoleView } = await requireAuthenticatedWorkspaceState()
  requireRealWorkspace(activeWorkspace)

  const sectionFilter = await buildScopedSectionWhere(user, activeWorkspace, activeRoleView)
  const studentFilter = await buildScopedStudentWhere(user, activeWorkspace, activeRoleView, {
    excludeFromAnalytics: true,
  })

  const [assessments, sections, electiveEnrollments, mentorAssignments, classAssignments] = await Promise.all([
    prisma.assessment.findMany({
      where: { isActive: true, offeringId: activeWorkspace.offeringId },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.section.findMany({
      where: sectionFilter,
      include: {
        students: {
          where: studentFilter,
          include: {
            marks: {
              include: { assessment: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    activeWorkspace.isElective
      ? prisma.courseOfferingEnrollment.findMany({
          where: {
            offeringId: activeWorkspace.offeringId,
            student: studentFilter,
          },
          include: {
            section: true,
            student: {
              include: {
                marks: {
                  include: { assessment: true },
                },
              },
            },
          },
          orderBy: { student: { rollNo: "asc" } },
        })
      : Promise.resolve([]),
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
      include: {
        section: true,
        faculty: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { section: { name: "asc" } },
    }),
  ])

  const activeAssessmentIds = new Set(assessments.map((assessment) => assessment.id))
  const weightConfig = getAssessmentWeightConfig(assessments)
  const facultyBySectionId = new Map(
    classAssignments.map((assignment) => [assignment.sectionId, assignment.faculty?.user.name ?? "Unassigned"])
  )
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

  const buildReportRow = ({
    sectionId,
    sectionName,
    facultyName,
    studentMarks,
  }: {
    sectionId: string
    sectionName: string
    facultyName: string | null
    studentMarks: Array<Array<{ marks: number; assessment: { code: string; name: string; category: string; weightage: number; maxMarks: number } }>>
  }): SectionReportData => {
    const studentMetrics = studentMarks.map((marks) => buildWeightedStudentTotals(marks))

    const computeAgg = (key: ReportMetricKey) =>
      computeMetricStats(
        studentMetrics.map((student) => student[key]),
        weightConfig[key]
      )

    return {
      sectionId,
      sectionName,
      facultyName,
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

  const buildComponentStats = ({
    sectionId,
    sectionName,
    studentMarks,
    assessmentId,
    maxMarks,
  }: {
    sectionId: string
    sectionName: string
    studentMarks: Array<Array<{ assessmentId: string; marks: number }>>
    assessmentId: string
    maxMarks: number
  }) => ({
    sectionId,
    sectionName,
    totalStudents: studentMarks.length,
    stats: computeMetricStats(
      studentMarks
        .map((marks) => marks.find((mark) => mark.assessmentId === assessmentId)?.marks)
        .filter((mark): mark is number => typeof mark === "number"),
      maxMarks
    ),
  })

  const sectionSummaries: SectionSummary[] = activeWorkspace.isElective
    ? [...new Map(
        electiveEnrollments.map((enrollment) => {
          const groupedEnrollments = electiveEnrollments.filter(
            (candidate) => candidate.sectionId === enrollment.sectionId
          )
          const groupedMarks = groupedEnrollments.map((candidate) =>
            candidate.student.marks
              .filter((mark) => activeAssessmentIds.has(mark.assessmentId))
              .map((mark) => ({
                assessmentId: mark.assessmentId,
                marks: mark.marks,
                assessment: {
                  code: mark.assessment.code,
                  name: mark.assessment.name,
                  category: mark.assessment.category,
                  weightage: mark.assessment.weightage,
                  maxMarks: mark.assessment.maxMarks,
                },
              }))
          )

          return [enrollment.sectionId, {
            sectionId: enrollment.sectionId,
            sectionName: formatDetailedCompactSectionName(enrollment.section),
            facultyName: facultyBySectionId.get(enrollment.sectionId) ?? mentorNameList[0] ?? "Mentor-owned",
            studentRecords: groupedEnrollments.map((candidate) => ({
              id: candidate.student.id,
              rollNo: candidate.student.rollNo,
              name: candidate.student.name,
            })),
            studentMarks: groupedMarks,
          }]
        })
      ).values()]
    : sections.map((section) => ({
        sectionId: section.id,
        sectionName: formatDetailedCompactSectionName(section),
        facultyName: facultyBySectionId.get(section.id) ?? "Unassigned",
        studentRecords: section.students.map((student) => ({
          id: student.id,
          rollNo: student.rollNo,
          name: student.name,
        })),
        studentMarks: section.students.map((student) =>
          student.marks
            .filter((mark) => activeAssessmentIds.has(mark.assessmentId))
            .map((mark) => ({
              assessmentId: mark.assessmentId,
              marks: mark.marks,
              assessment: {
                code: mark.assessment.code,
                name: mark.assessment.name,
                category: mark.assessment.category,
                weightage: mark.assessment.weightage,
                maxMarks: mark.assessment.maxMarks,
              },
            }))
        ),
      }))

  return {
    activeRoleView,
    activeWorkspace,
    assessments,
    sections,
    weightConfig,
    mentorNameList,
    courseTeamNames,
    sectionSummaries,
    buildReportRow,
    buildComponentStats,
  }
}

export async function getReportsSummaryData() {
  const {
    activeRoleView,
    activeWorkspace,
    sections,
    mentorNameList,
    courseTeamNames,
    sectionSummaries,
    buildReportRow,
  } = await loadReportsWorkspaceData()

  const reportData = sectionSummaries.map((summary) => buildReportRow(summary))
  const isCourseView = activeRoleView !== "faculty" && sections.length > 1

  const courseAggregate = isCourseView
    ? buildReportRow({
        sectionId: "ALL",
        sectionName: "Entire Course",
        facultyName: "All Faculty",
        studentMarks: sectionSummaries.flatMap((summary) => summary.studentMarks),
      })
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
    buildComponentStats,
    buildReportRow,
    weightConfig,
  } = await loadReportsWorkspaceData()

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

  const allRows = sectionSummaries.map((summary) => buildReportRow(summary))

  if (isCourseView) {
    allRows.push(
      buildReportRow({
        sectionId: "ALL",
        sectionName: "Entire Course",
        facultyName: "All Faculty",
        studentMarks: sectionSummaries.flatMap((summary) => summary.studentMarks),
      })
    )
  }

  return {
    componentReports,
    finalMarkStemData,
  }
}
