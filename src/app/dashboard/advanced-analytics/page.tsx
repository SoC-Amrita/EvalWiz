import { auth } from "@/auth"
import { buildScopedStudentWhere, getActiveWorkspaceState } from "@/lib/course-workspace"
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
  const studentWhere = await buildScopedStudentWhere(user, activeWorkspace, activeRoleView)

  // Load raw marks with all context in one query
  const rawMarks: RawMark[] = activeWorkspace.isElective
    ? await prisma.courseOfferingEnrollment.findMany({
        where: {
          offeringId: activeWorkspace.offeringId,
          student: studentWhere,
        },
        include: {
          section: true,
          student: {
            include: {
              marks: {
                where: {
                  assessment: { offeringId: activeWorkspace.offeringId },
                },
                include: {
                  assessment: true,
                },
              },
            },
          },
        },
        orderBy: [
          { section: { name: "asc" } },
          { student: { rollNo: "asc" } },
        ],
      }).then((enrollments) =>
        enrollments.flatMap((enrollment) =>
          enrollment.student.marks.map((mark) => ({
            studentId: enrollment.studentId,
            rollNo: enrollment.student.rollNo,
            sectionId: enrollment.sectionId,
            sectionName: enrollment.section.name,
            assessmentId: mark.assessmentId,
            assessmentCode: mark.assessment.code,
            assessmentName: mark.assessment.name,
            assessmentCategory: mark.assessment.category,
            assessmentMax: mark.assessment.maxMarks,
            assessmentWeightage: mark.assessment.weightage,
            marks: mark.marks,
          }))
        )
      )
    : await prisma.mark.findMany({
        where: {
          student: studentWhere,
          assessment: { offeringId: activeWorkspace.offeringId },
        },
        include: {
          student: { include: { section: true } },
          assessment: true,
        },
        orderBy: [
          { student: { section: { name: "asc" } } },
          { assessment: { displayOrder: "asc" } },
        ],
      }).then((marks) =>
        marks.map((mark) => ({
          studentId: mark.studentId,
          rollNo: mark.student.rollNo,
          sectionId: mark.student.section.id,
          sectionName: mark.student.section.name,
          assessmentId: mark.assessmentId,
          assessmentCode: mark.assessment.code,
          assessmentName: mark.assessment.name,
          assessmentCategory: mark.assessment.category,
          assessmentMax: mark.assessment.maxMarks,
          assessmentWeightage: mark.assessment.weightage,
          marks: mark.marks,
        }))
      )

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
