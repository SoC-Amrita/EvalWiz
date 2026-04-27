export const APP_INFO = {
  name: "EvalWiz",
  developer: "Team SE@SoCAmrita",
  department: "Department of Computer Science & Engineering",
  school: "School of Computing",
  institution: "Amrita Vishwa Vidyapeetham, Coimbatore",
  subjectCode: "23CSE311",
  subjectTitle: "Software Engineering",
  academicYear: "2025 - 2026",
  term: "Even / Winter",
  semester: "VI",
  year: "III",
  course: "BTech CSE",
} as const

export function getCourseDisplayTitle() {
  return `${APP_INFO.subjectCode} - ${APP_INFO.subjectTitle}`
}
