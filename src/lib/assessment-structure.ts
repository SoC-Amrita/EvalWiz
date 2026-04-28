import { METRIC_COLOR_MAP } from "./chart-theme"

export type AssessmentFamily =
  | "CONTINUOUS_ASSESSMENT"
  | "MID_TERM"
  | "END_SEMESTER"
  | "OTHER"

export type CASubcomponent = "QUIZ" | "REVIEW" | "OTHER" | null

export type ReportMetricKey =
  | "quiz"
  | "review"
  | "ca"
  | "midTerm"
  | "caMidTerm"
  | "endSemester"
  | "overall"

export type AssessmentLike = {
  code: string
  name: string
  category: string
  weightage: number
  maxMarks: number
  includeInAgg?: boolean
}

export type WeightedMarkLike = {
  marks: number
  assessment: AssessmentLike
}

export type MetricStats = {
  outOf: number
  avg: number
  median: number
  mode: number | string
  stdDev: number
  max: number
  min: number
}

export type MetricTotals = Record<ReportMetricKey, number>

export const REPORT_METRICS: Array<{
  key: ReportMetricKey
  label: string
  shortLabel: string
  color: string
}> = [
  { key: "quiz", label: "Quiz", shortLabel: "Quiz", color: METRIC_COLOR_MAP.quiz },
  { key: "review", label: "Review", shortLabel: "Review", color: METRIC_COLOR_MAP.review },
  { key: "ca", label: "Continuous Assessment", shortLabel: "CA", color: METRIC_COLOR_MAP.ca },
  { key: "midTerm", label: "Mid Term", shortLabel: "Mid", color: METRIC_COLOR_MAP.midTerm },
  { key: "caMidTerm", label: "CA + Mid Term", shortLabel: "CA+Mid", color: METRIC_COLOR_MAP.caMidTerm },
  { key: "endSemester", label: "End Semester", shortLabel: "End Sem", color: METRIC_COLOR_MAP.endSemester },
  { key: "overall", label: "Overall", shortLabel: "Overall", color: METRIC_COLOR_MAP.overall },
]

export function normalizeAssessmentText(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export function classifyAssessment(assessment: Pick<AssessmentLike, "code" | "name" | "category">) {
  const code = normalizeAssessmentText(assessment.code)
  const name = normalizeAssessmentText(assessment.name)
  const category = normalizeAssessmentText(assessment.category)
  const combined = `${category}_${code}_${name}`

  const isMidTerm =
    category.includes("MID") ||
    code.includes("MID") ||
    name.includes("MID_TERM") ||
    name.includes("MIDTERM")
  if (isMidTerm) {
    return {
      family: "MID_TERM" as AssessmentFamily,
      familyLabel: "Mid Term",
      subcomponent: null as CASubcomponent,
      subcomponentLabel: null,
      analyticsFilterKey: "MID_TERM",
    }
  }

  const isEndSemester =
    category.includes("END") ||
    category.includes("SEM") ||
    code.includes("END") ||
    name.includes("END_SEM") ||
    name.includes("END_SEMESTER")
  if (isEndSemester) {
    return {
      family: "END_SEMESTER" as AssessmentFamily,
      familyLabel: "End Semester",
      subcomponent: null as CASubcomponent,
      subcomponentLabel: null,
      analyticsFilterKey: "END_SEMESTER",
    }
  }

  const isReview =
    category.includes("REVIEW") ||
    category.includes("SPRINT") ||
    code.startsWith("SP") ||
    combined.includes("SPRINT") ||
    combined.includes("REVIEW")
  if (isReview) {
    return {
      family: "CONTINUOUS_ASSESSMENT" as AssessmentFamily,
      familyLabel: "Continuous Assessment",
      subcomponent: "REVIEW" as CASubcomponent,
      subcomponentLabel: "Review",
      analyticsFilterKey: "CA_REVIEW",
    }
  }

  const isQuiz =
    category.includes("QUIZ") ||
    code.startsWith("QZ") ||
    combined.includes("QUIZ")
  if (isQuiz) {
    return {
      family: "CONTINUOUS_ASSESSMENT" as AssessmentFamily,
      familyLabel: "Continuous Assessment",
      subcomponent: "QUIZ" as CASubcomponent,
      subcomponentLabel: "Quiz",
      analyticsFilterKey: "CA_QUIZ",
    }
  }

  const isCA =
    category.includes("CONTINUOUS") ||
    category === "CA" ||
    category.startsWith("CA_") ||
    category.includes("INTERNAL")
  if (isCA) {
    return {
      family: "CONTINUOUS_ASSESSMENT" as AssessmentFamily,
      familyLabel: "Continuous Assessment",
      subcomponent: "OTHER" as CASubcomponent,
      subcomponentLabel: "Other CA",
      analyticsFilterKey: "CA_OTHER",
    }
  }

  return {
    family: "OTHER" as AssessmentFamily,
    familyLabel: "Other",
    subcomponent: null as CASubcomponent,
    subcomponentLabel: null,
    analyticsFilterKey: "OTHER",
  }
}

export function createEmptyMetricStats(outOf = 0): MetricStats {
  return {
    outOf: Number(outOf.toFixed(2)),
    avg: 0,
    median: 0,
    mode: "N/A",
    stdDev: 0,
    max: 0,
    min: 0,
  }
}

export function createEmptyMetricTotals(): MetricTotals {
  return {
    quiz: 0,
    review: 0,
    ca: 0,
    midTerm: 0,
    caMidTerm: 0,
    endSemester: 0,
    overall: 0,
  }
}

export function getAssessmentWeightConfig(assessments: AssessmentLike[]) {
  const totals = createEmptyMetricTotals()

  assessments.forEach((assessment) => {
    if (assessment.includeInAgg === false) return
    const classification = classifyAssessment(assessment)
    const weightage = assessment.weightage

    if (classification.family === "CONTINUOUS_ASSESSMENT") {
      totals.ca += weightage
      if (classification.subcomponent === "QUIZ") totals.quiz += weightage
      if (classification.subcomponent === "REVIEW") totals.review += weightage
    }

    if (classification.family === "MID_TERM") totals.midTerm += weightage
    if (classification.family === "END_SEMESTER") totals.endSemester += weightage
    totals.overall += weightage
  })

  totals.caMidTerm = totals.ca + totals.midTerm

  return totals
}

export function getWeightedContribution(mark: WeightedMarkLike) {
  if (mark.assessment.maxMarks <= 0) return 0
  return (mark.marks / mark.assessment.maxMarks) * mark.assessment.weightage
}

export function roundGrandTotal(value: number) {
  const floor = Math.floor(value)
  return value - floor < 0.5 ? floor : Math.ceil(value)
}

export function buildWeightedStudentTotals(marks: WeightedMarkLike[]) {
  const totals = createEmptyMetricTotals()

  marks.forEach((mark) => {
    if (mark.assessment.includeInAgg === false) return
    const weighted = getWeightedContribution(mark)
    const classification = classifyAssessment(mark.assessment)

    totals.overall += weighted

    if (classification.family === "CONTINUOUS_ASSESSMENT") {
      totals.ca += weighted
      if (classification.subcomponent === "QUIZ") totals.quiz += weighted
      if (classification.subcomponent === "REVIEW") totals.review += weighted
    } else if (classification.family === "MID_TERM") {
      totals.midTerm += weighted
    } else if (classification.family === "END_SEMESTER") {
      totals.endSemester += weighted
    }
  })

  totals.caMidTerm = totals.ca + totals.midTerm
  totals.overall = roundGrandTotal(totals.overall)

  return totals
}

export function computeMetricStats(values: number[], outOf: number): MetricStats {
  if (values.length === 0) return createEmptyMetricStats(outOf)

  const sorted = [...values].sort((left, right) => left - right)
  const count = values.length
  const avg = values.reduce((sum, value) => sum + value, 0) / count
  const middle = Math.floor(count / 2)
  const median =
    count % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle]

  const frequency: Record<string, number> = {}
  let highestFrequency = 0
  let modeValue = sorted[0]

  values.forEach((value) => {
    const rounded = Number(value.toFixed(1))
    frequency[rounded] = (frequency[rounded] || 0) + 1
    if (frequency[rounded] > highestFrequency) {
      highestFrequency = frequency[rounded]
      modeValue = rounded
    }
  })

  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / count

  return {
    outOf: Number(outOf.toFixed(2)),
    avg: Number(avg.toFixed(2)),
    median: Number(median.toFixed(2)),
    mode:
      highestFrequency === 1 && values.length > 1
        ? "N/A"
        : Number(modeValue.toFixed(1)),
    stdDev: Number(Math.sqrt(variance).toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
    min: Number(Math.min(...values).toFixed(2)),
  }
}

export function buildAnalyticsComponentFilters(assessments: AssessmentLike[]) {
  const options = [
    {
      key: "ALL",
      label: "All components",
      matcher: () => true,
    },
    {
      key: "CONTINUOUS_ASSESSMENT",
      label: "Continuous Assessment",
      matcher: (assessment: AssessmentLike) =>
        classifyAssessment(assessment).family === "CONTINUOUS_ASSESSMENT",
    },
    {
      key: "CA_QUIZ",
      label: "CA - Quiz",
      matcher: (assessment: AssessmentLike) =>
        classifyAssessment(assessment).analyticsFilterKey === "CA_QUIZ",
    },
    {
      key: "CA_REVIEW",
      label: "CA - Review",
      matcher: (assessment: AssessmentLike) =>
        classifyAssessment(assessment).analyticsFilterKey === "CA_REVIEW",
    },
    {
      key: "MID_TERM",
      label: "Mid Term",
      matcher: (assessment: AssessmentLike) =>
        classifyAssessment(assessment).family === "MID_TERM",
    },
    {
      key: "END_SEMESTER",
      label: "End Semester",
      matcher: (assessment: AssessmentLike) =>
        classifyAssessment(assessment).family === "END_SEMESTER",
    },
  ]

  return options.filter((option) =>
    option.key === "ALL" || assessments.some((assessment) => option.matcher(assessment))
  )
}
