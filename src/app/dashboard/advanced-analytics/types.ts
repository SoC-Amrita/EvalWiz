import type { GradeRuleConfig } from "@/lib/grade-rules"

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
  assessmentIncludeInAgg: boolean
  marks: number
}

export type AssessmentMeta = {
  id: string
  code: string
  name: string
  category: string
  maxMarks: number
  weightage: number
  includeInAgg: boolean
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

export type AdvancedAnalyticsSummary = {
  totalStudents: number
  totalSections: number
  totalAssessments: number
  totalMarks: number
  mentorNames: string[]
  exportMeta: AdvancedAnalyticsExportMeta
}

export type AdvancedAnalyticsGradeRuleAccess = {
  activeRoleView: "administrator" | "mentor" | "faculty"
  canEditGradeRules: boolean
  gradeRuleConfig: GradeRuleConfig
}
