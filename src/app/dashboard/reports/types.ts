import type { MetricStats } from "@/lib/assessment-structure"

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

export type FinalMarkStemPoint = {
  studentId: string
  rollNo: string
  studentName: string
  sectionId: string
  sectionName: string
  score: number
  outOf: number
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
