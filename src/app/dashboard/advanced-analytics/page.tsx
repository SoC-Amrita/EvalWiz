import { auth } from "@/auth"
import { buildScopedSectionWhere, getActiveWorkspaceState } from "@/lib/course-workspace"
import prisma from "@/lib/db"
import { redirect } from "next/navigation"
import { AdvancedAnalyticsClient } from "./client"

export type RawMark = {
  studentId: string
  rollNo: string
  sectionId: string
  sectionName: string
  assessmentId: string
  assessmentCode: string
  assessmentName: string
  assessmentCategory: string
  assessmentMax: number
  assessmentWeightage: number
  marks: number
}

export type AssessmentMeta = {
  id: string
  code: string
  name: string
  category: string
  maxMarks: number
  weightage: number
}

export type SectionMeta = { id: string; name: string }
export type AdvancedAnalyticsExportMeta = {
  department: string
  school: string
  institution: string
  subjectCode: string
  subjectTitle: string
  program: string
  academicYear: string
  term: string
  semester: string
  year: string
  mentors: string[]
  courseType: string
  evaluationPattern: string
}

export default async function AdvancedAnalyticsPage() {
  const session = await auth()
  const user = session?.user
  if (!user) redirect("/login")

  const { activeWorkspace, activeRoleView } = await getActiveWorkspaceState(user)
  const sectionWhere = await buildScopedSectionWhere(user, activeWorkspace, activeRoleView)

  // Load raw marks with all context in one query
  const marks = await prisma.mark.findMany({
    where: {
      student: { section: sectionWhere },
      assessment: { offeringId: activeWorkspace.offeringId },
    },
    include: {
      student: { include: { section: true } },
      assessment: true,
    },
    orderBy: [
      { student: { section: { name: "asc" } } },
      { assessment: { displayOrder: "asc" } }
    ]
  })

  const rawMarks: RawMark[] = marks.map(m => ({
    studentId: m.studentId,
    rollNo: m.student.rollNo,
    sectionId: m.student.section.id,
    sectionName: m.student.section.name,
    assessmentId: m.assessmentId,
    assessmentCode: m.assessment.code,
    assessmentName: m.assessment.name,
    assessmentCategory: m.assessment.category,
    assessmentMax: m.assessment.maxMarks,
    assessmentWeightage: m.assessment.weightage,
    marks: m.marks,
  }))

  // Unique assessments and sections (sorted)
  const assessmentMap = new Map<string, AssessmentMeta>()
  const sectionMap = new Map<string, SectionMeta>()
  rawMarks.forEach(m => {
    if (!assessmentMap.has(m.assessmentId))
      assessmentMap.set(m.assessmentId, { id: m.assessmentId, code: m.assessmentCode, name: m.assessmentName, category: m.assessmentCategory, maxMarks: m.assessmentMax, weightage: m.assessmentWeightage })
    if (!sectionMap.has(m.sectionId))
      sectionMap.set(m.sectionId, { id: m.sectionId, name: m.sectionName })
  })

  const mentorAssignments = await prisma.courseOfferingMentor.findMany({
    where: { offeringId: activeWorkspace.offeringId },
    orderBy: { user: { name: "asc" } },
    select: {
      user: {
        select: { name: true },
      },
    },
  })

  const mentorNames = mentorAssignments
    .map((mentor) => mentor.user.name)
    .filter((name): name is string => Boolean(name))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Advanced Analytics</h1>
        <p className="text-slate-500">Deep statistical visualizations for {activeWorkspace.subjectCode} in the active workspace.</p>
      </div>
      <AdvancedAnalyticsClient
        rawMarks={rawMarks}
        assessments={[...assessmentMap.values()]}
        sections={[...sectionMap.values()]}
        exportMeta={{
          department: "Department of Computer Science & Engineering",
          school: "School of Computing",
          institution: "Amrita Vishwa Vidyapeetham, Coimbatore",
          subjectCode: activeWorkspace.subjectCode,
          subjectTitle: activeWorkspace.subjectTitle,
          program: activeWorkspace.program,
          academicYear: activeWorkspace.academicYear,
          term: activeWorkspace.term,
          semester: activeWorkspace.semester,
          year: activeWorkspace.year,
          mentors: mentorNames,
          courseType: activeWorkspace.courseType,
          evaluationPattern: activeWorkspace.evaluationPattern,
        }}
      />
    </div>
  )
}
