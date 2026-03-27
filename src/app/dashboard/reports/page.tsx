import { auth } from "@/auth"
import { APP_INFO } from "@/lib/app-info"
import { buildScopedSectionWhere, getActiveWorkspaceState } from "@/lib/course-workspace"
import prisma from "@/lib/db"
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
  const [assessments, sections, mentorAssignments, classAssignments] = await Promise.all([
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

  const reportData: SectionReportData[] = sections.map((section) =>
    buildReportRow({
      sectionId: section.id,
      sectionName: section.name,
      facultyName: facultyBySectionId.get(section.id) ?? "Unassigned",
      studentMarks: section.students.map((student) =>
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
      ),
    })
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Consolidated Section Reports
        </h1>
        <p className="text-slate-500">
          Structured statistical reporting for {activeWorkspace.subjectCode} across the active workspace.
        </p>
      </div>

      <ReportsClient
        data={reportData}
        courseAggregate={courseAggregate}
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
