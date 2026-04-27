import { buildScopedSectionWhere, buildScopedStudentWhere } from "@/lib/course-workspace"
import prisma from "@/lib/db"
import { APP_INFO } from "@/lib/app-info"
import { parseGradeRuleConfig } from "@/lib/grade-rules"
import { requireAuthenticatedWorkspaceState, requireRealWorkspace } from "@/lib/workspace-guards"
import { formatCompactProgramSectionName } from "@/lib/workspace-labels"

import type {
  AdvancedAnalyticsSummary,
  AssessmentMeta,
  RawMark,
  SectionMeta,
  AdvancedAnalyticsGradeRuleAccess,
} from "./types"

async function loadAdvancedAnalyticsBase() {
  const { user, activeWorkspace, activeRoleView } = await requireAuthenticatedWorkspaceState()
  requireRealWorkspace(activeWorkspace)

  const studentWhere = await buildScopedStudentWhere(user, activeWorkspace, activeRoleView, {
    excludeFromAnalytics: true,
  })
  const sectionWhere = await buildScopedSectionWhere(user, activeWorkspace, activeRoleView)

  const [assessments, sections, mentorAssignments, totalStudents, totalMarks, offeringConfig] = await Promise.all([
    prisma.assessment.findMany({
      where: { isActive: true, offeringId: activeWorkspace.offeringId },
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        maxMarks: true,
        weightage: true,
      },
    }),
    prisma.section.findMany({
      where: sectionWhere,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
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
    prisma.student.count({ where: studentWhere }),
    prisma.mark.count({
      where: {
        student: studentWhere,
        assessment: { offeringId: activeWorkspace.offeringId },
      },
    }),
    prisma.courseOffering.findFirst({
      where: { id: activeWorkspace.offeringId },
      select: { gradeRulesConfig: true },
    }),
  ])

  const mentorNames = mentorAssignments
    .map((mentor) => mentor.user.name)
    .filter((name): name is string => Boolean(name))

  return {
    activeWorkspace,
    assessments,
    sections,
    mentorNames,
    activeRoleView,
    totalStudents,
    totalSections: sections.length,
    totalMarks,
    gradeRuleAccess: {
      activeRoleView,
      canEditGradeRules: activeRoleView === "mentor",
      gradeRuleConfig: parseGradeRuleConfig(offeringConfig?.gradeRulesConfig),
    } satisfies AdvancedAnalyticsGradeRuleAccess,
    studentWhere,
    exportMeta: {
      department: APP_INFO.department,
      school: APP_INFO.school,
      institution: APP_INFO.institution,
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
    },
  }
}

export async function getAdvancedAnalyticsSummaryData(): Promise<AdvancedAnalyticsSummary> {
  const {
    assessments,
    mentorNames,
    totalStudents,
    totalSections,
    totalMarks,
    exportMeta,
    gradeRuleAccess,
  } = await loadAdvancedAnalyticsBase()

  return {
    totalStudents,
    totalSections,
    totalAssessments: assessments.length,
    totalMarks,
    mentorNames,
    exportMeta,
    ...gradeRuleAccess,
  }
}

export async function getAdvancedAnalyticsDetailData(): Promise<{
  rawMarks: RawMark[]
  assessments: AssessmentMeta[]
  sections: SectionMeta[]
  exportMeta: AdvancedAnalyticsSummary["exportMeta"]
} & AdvancedAnalyticsGradeRuleAccess> {
  const {
    activeWorkspace,
    assessments,
    exportMeta,
    gradeRuleAccess,
    sections,
    studentWhere,
  } = await loadAdvancedAnalyticsBase()

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
            sectionName: formatCompactProgramSectionName(enrollment.section),
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
          sectionName: formatCompactProgramSectionName(mark.student.section),
          assessmentId: mark.assessmentId,
          assessmentCode: mark.assessment.code,
          assessmentName: mark.assessment.name,
          assessmentCategory: mark.assessment.category,
          assessmentMax: mark.assessment.maxMarks,
          assessmentWeightage: mark.assessment.weightage,
          marks: mark.marks,
        }))
      )

  return {
    rawMarks,
    assessments: assessments.map((assessment) => ({
      id: assessment.id,
      code: assessment.code,
      name: assessment.name,
      category: assessment.category,
      maxMarks: assessment.maxMarks,
      weightage: assessment.weightage,
    })),
    sections: sections.map((section) => ({
      id: section.id,
      name: formatCompactProgramSectionName(section),
    })),
    exportMeta,
    ...gradeRuleAccess,
  }
}
