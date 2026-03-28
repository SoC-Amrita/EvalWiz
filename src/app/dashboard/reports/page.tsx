import { auth } from "@/auth"
import { APP_INFO } from "@/lib/app-info"
import { buildScopedSectionWhere, buildScopedStudentWhere, getActiveWorkspaceState } from "@/lib/course-workspace"
import prisma from "@/lib/db"
import { formatDetailedCompactSectionName, formatWorkspaceCode } from "@/lib/workspace-labels"
import {
  buildWeightedStudentTotals,
  computeMetricStats,
  getAssessmentWeightConfig,
  type MetricStats,
  type ReportMetricKey,
} from "@/lib/assessment-structure"
import { redirect } from "next/navigation"
import { ReportsClient } from "./client"

export type SectionReportData = {
  sectionId: string
  sectionName: string
  facultyName: string | null
  totalStudents: number
  quiz: MetricStats
  review: MetricStats
  ca: MetricStats
  midTerm: MetricStats
  caMidTerm: MetricStats
  endSemester: MetricStats
  overall: MetricStats
}

export type AssessmentComponentReport = {
  assessmentId: string
  assessmentCode: string
  assessmentName: string
  assessmentCategory: string
  maxMarks: number
  rows: Array<{
    sectionId: string
    sectionName: string
    totalStudents: number
    stats: MetricStats
  }>
}

export type ReportMeta = {
  appName: string
  school: string
  department: string
  institution: string
  subjectCode: string
  subjectTitle: string
  academicYear: string
  term: string
  semester: string
  year: string
  course: string
  courseType: string
  evaluationPattern: string
  developer: string
  mentorNames: string[]
  courseTeamNames: string[]
}

export default async function ReportsPage() {
  const session = await auth()
  const user = session?.user
  if (!user) redirect("/login")

  const { activeWorkspace, activeRoleView } = await getActiveWorkspaceState(user)
  const sectionFilter = await buildScopedSectionWhere(user, activeWorkspace, activeRoleView)
  const studentFilter = await buildScopedStudentWhere(user, activeWorkspace, activeRoleView)
  const [assessments, sections, electiveEnrollments, mentorAssignments, classAssignments] = await Promise.all([
    prisma.assessment.findMany({
      where: { isActive: true, offeringId: activeWorkspace.offeringId },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.section.findMany({
      where: sectionFilter,
      include: {
        students: {
          include: {
            marks: {
              include: { assessment: true }
            }
          }
        }
      },
      orderBy: { name: "asc" }
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
    const studentMetrics = studentMarks.map((marks) =>
      buildWeightedStudentTotals(marks)
    )

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

  const sectionSummaries: Array<{
    sectionId: string
    sectionName: string
    facultyName: string | null
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
  }> = activeWorkspace.isElective
    ? [...new Map(
        electiveEnrollments.map((enrollment) => {
          const groupedMarks = electiveEnrollments
            .filter((candidate) => candidate.sectionId === enrollment.sectionId)
            .map((candidate) =>
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
            studentMarks: groupedMarks,
          }]
        })
      ).values()]
    : sections.map((section) => ({
        sectionId: section.id,
        sectionName: formatDetailedCompactSectionName(section),
        facultyName: facultyBySectionId.get(section.id) ?? "Unassigned",
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

  const reportData: SectionReportData[] = sectionSummaries.map((summary) =>
    buildReportRow(summary)
  )

  const isCourseView = activeRoleView !== "faculty" && sections.length > 1
  let courseAggregate: SectionReportData | null = null

  if (isCourseView) {
    courseAggregate = buildReportRow({
      sectionId: "ALL",
      sectionName: "Entire Course",
      facultyName: "All Faculty",
      studentMarks: sections.flatMap((section) =>
        section.students.map((student) =>
          student.marks
            .filter((mark) => activeAssessmentIds.has(mark.assessmentId))
            .map((mark) => ({
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
      ),
    })
  }

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Consolidated Section Reports
        </h1>
        <p className="text-slate-500">
          Structured statistical reporting for {formatWorkspaceCode(activeWorkspace)}.
        </p>
      </div>

      <ReportsClient
        data={reportData}
        courseAggregate={courseAggregate}
        componentReports={componentReports}
        reportMeta={{
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
        }}
      />
    </div>
  )
}
