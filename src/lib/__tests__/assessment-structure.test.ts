import { describe, it, expect } from "vitest"
import {
  normalizeAssessmentText,
  classifyAssessment,
  createEmptyMetricStats,
  createEmptyMetricTotals,
  getAssessmentWeightConfig,
  getWeightedContribution,
  buildWeightedStudentTotals,
  computeMetricStats,
  buildAnalyticsComponentFilters,
  type AssessmentLike,
  type WeightedMarkLike,
} from "@/lib/assessment-structure"

// ---------------------------------------------------------------------------
// normalizeAssessmentText
// ---------------------------------------------------------------------------
describe("normalizeAssessmentText", () => {
  it("uppercases and trims the value", () => {
    expect(normalizeAssessmentText("  quiz  ")).toBe("QUIZ")
  })

  it("replaces non-alphanumeric characters with underscores", () => {
    expect(normalizeAssessmentText("Mid Term")).toBe("MID_TERM")
  })

  it("strips leading and trailing underscores", () => {
    expect(normalizeAssessmentText("-Quiz-")).toBe("QUIZ")
  })

  it("handles already normalized input", () => {
    expect(normalizeAssessmentText("QUIZ")).toBe("QUIZ")
  })
})

// ---------------------------------------------------------------------------
// classifyAssessment
// ---------------------------------------------------------------------------
describe("classifyAssessment", () => {
  it("classifies a mid-term assessment by category", () => {
    const result = classifyAssessment({ code: "MT1", name: "Mid Term 1", category: "MID" })
    expect(result.family).toBe("MID_TERM")
    expect(result.subcomponent).toBeNull()
  })

  it("classifies a mid-term assessment by name", () => {
    const result = classifyAssessment({ code: "A1", name: "MidTerm Exam", category: "EXAM" })
    expect(result.family).toBe("MID_TERM")
  })

  it("classifies an end-semester assessment by category", () => {
    const result = classifyAssessment({ code: "ES1", name: "Final", category: "END_SEM" })
    expect(result.family).toBe("END_SEMESTER")
  })

  it("classifies an end-semester assessment by name", () => {
    const result = classifyAssessment({ code: "A1", name: "End Semester Exam", category: "EXAM" })
    expect(result.family).toBe("END_SEMESTER")
  })

  it("classifies a review/sprint assessment", () => {
    const result = classifyAssessment({ code: "SP1", name: "Sprint Review 1", category: "SPRINT" })
    expect(result.family).toBe("CONTINUOUS_ASSESSMENT")
    expect(result.subcomponent).toBe("REVIEW")
  })

  it("classifies a quiz assessment by category", () => {
    const result = classifyAssessment({ code: "QZ1", name: "Quiz 1", category: "QUIZ" })
    expect(result.family).toBe("CONTINUOUS_ASSESSMENT")
    expect(result.subcomponent).toBe("QUIZ")
  })

  it("classifies a quiz by code prefix QZ", () => {
    const result = classifyAssessment({ code: "QZ2", name: "Test", category: "OTHER" })
    expect(result.subcomponent).toBe("QUIZ")
  })

  it("classifies a continuous assessment by category", () => {
    const result = classifyAssessment({ code: "CA1", name: "Assignment", category: "CONTINUOUS" })
    expect(result.family).toBe("CONTINUOUS_ASSESSMENT")
    expect(result.subcomponent).toBe("OTHER")
  })

  it("classifies as OTHER when no pattern matches", () => {
    const result = classifyAssessment({ code: "X1", name: "Unknown", category: "RANDOM" })
    expect(result.family).toBe("OTHER")
    expect(result.subcomponent).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// createEmptyMetricStats
// ---------------------------------------------------------------------------
describe("createEmptyMetricStats", () => {
  it("creates stats with all zeros and N/A mode by default", () => {
    const stats = createEmptyMetricStats()
    expect(stats.outOf).toBe(0)
    expect(stats.avg).toBe(0)
    expect(stats.median).toBe(0)
    expect(stats.mode).toBe("N/A")
    expect(stats.stdDev).toBe(0)
    expect(stats.max).toBe(0)
    expect(stats.min).toBe(0)
  })

  it("sets outOf to the provided value", () => {
    const stats = createEmptyMetricStats(50)
    expect(stats.outOf).toBe(50)
  })

  it("rounds outOf to 2 decimal places", () => {
    const stats = createEmptyMetricStats(33.3333)
    expect(stats.outOf).toBe(33.33)
  })
})

// ---------------------------------------------------------------------------
// createEmptyMetricTotals
// ---------------------------------------------------------------------------
describe("createEmptyMetricTotals", () => {
  it("creates totals with all zeros", () => {
    const totals = createEmptyMetricTotals()
    expect(totals.quiz).toBe(0)
    expect(totals.review).toBe(0)
    expect(totals.ca).toBe(0)
    expect(totals.midTerm).toBe(0)
    expect(totals.caMidTerm).toBe(0)
    expect(totals.endSemester).toBe(0)
    expect(totals.overall).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getAssessmentWeightConfig
// ---------------------------------------------------------------------------
describe("getAssessmentWeightConfig", () => {
  const assessments: AssessmentLike[] = [
    { code: "QZ1", name: "Quiz 1", category: "QUIZ", weightage: 10, maxMarks: 10 },
    { code: "SP1", name: "Sprint 1", category: "REVIEW", weightage: 15, maxMarks: 15 },
    { code: "MT1", name: "Mid Term", category: "MID", weightage: 25, maxMarks: 25 },
    { code: "ES1", name: "End Sem", category: "END", weightage: 50, maxMarks: 50 },
  ]

  it("computes correct overall total", () => {
    const config = getAssessmentWeightConfig(assessments)
    expect(config.overall).toBe(100)
  })

  it("computes correct CA total (quiz + review)", () => {
    const config = getAssessmentWeightConfig(assessments)
    expect(config.ca).toBe(25)
  })

  it("computes correct quiz total", () => {
    const config = getAssessmentWeightConfig(assessments)
    expect(config.quiz).toBe(10)
  })

  it("computes correct review total", () => {
    const config = getAssessmentWeightConfig(assessments)
    expect(config.review).toBe(15)
  })

  it("computes correct midTerm total", () => {
    const config = getAssessmentWeightConfig(assessments)
    expect(config.midTerm).toBe(25)
  })

  it("computes correct endSemester total", () => {
    const config = getAssessmentWeightConfig(assessments)
    expect(config.endSemester).toBe(50)
  })

  it("sets caMidTerm as sum of ca and midTerm", () => {
    const config = getAssessmentWeightConfig(assessments)
    expect(config.caMidTerm).toBe(config.ca + config.midTerm)
  })

  it("returns all-zero totals for empty assessment list", () => {
    const config = getAssessmentWeightConfig([])
    expect(config.overall).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getWeightedContribution
// ---------------------------------------------------------------------------
describe("getWeightedContribution", () => {
  it("computes weighted contribution correctly", () => {
    const mark: WeightedMarkLike = {
      marks: 8,
      assessment: { code: "QZ1", name: "Quiz 1", category: "QUIZ", weightage: 10, maxMarks: 10 },
    }
    expect(getWeightedContribution(mark)).toBeCloseTo(8)
  })

  it("returns 0 when maxMarks is 0", () => {
    const mark: WeightedMarkLike = {
      marks: 5,
      assessment: { code: "A1", name: "A1", category: "CA", weightage: 10, maxMarks: 0 },
    }
    expect(getWeightedContribution(mark)).toBe(0)
  })

  it("returns 0 when maxMarks is negative", () => {
    const mark: WeightedMarkLike = {
      marks: 5,
      assessment: { code: "A1", name: "A1", category: "CA", weightage: 10, maxMarks: -5 },
    }
    expect(getWeightedContribution(mark)).toBe(0)
  })

  it("scales correctly for partial marks", () => {
    const mark: WeightedMarkLike = {
      marks: 50,
      assessment: { code: "ES1", name: "End Sem", category: "END", weightage: 50, maxMarks: 100 },
    }
    expect(getWeightedContribution(mark)).toBe(25)
  })
})

// ---------------------------------------------------------------------------
// buildWeightedStudentTotals
// ---------------------------------------------------------------------------
describe("buildWeightedStudentTotals", () => {
  const marks: WeightedMarkLike[] = [
    {
      marks: 10,
      assessment: { code: "QZ1", name: "Quiz 1", category: "QUIZ", weightage: 10, maxMarks: 10 },
    },
    {
      marks: 15,
      assessment: { code: "SP1", name: "Sprint 1", category: "REVIEW", weightage: 15, maxMarks: 15 },
    },
    {
      marks: 20,
      assessment: { code: "MT1", name: "Mid Term", category: "MID", weightage: 25, maxMarks: 25 },
    },
    {
      marks: 40,
      assessment: { code: "ES1", name: "End Sem", category: "END", weightage: 50, maxMarks: 50 },
    },
  ]

  it("computes overall total correctly", () => {
    const totals = buildWeightedStudentTotals(marks)
    expect(totals.overall).toBeCloseTo(10 + 15 + 20 + 40)
  })

  it("accumulates quiz marks", () => {
    const totals = buildWeightedStudentTotals(marks)
    expect(totals.quiz).toBeCloseTo(10)
  })

  it("accumulates review marks", () => {
    const totals = buildWeightedStudentTotals(marks)
    expect(totals.review).toBeCloseTo(15)
  })

  it("accumulates CA as quiz + review", () => {
    const totals = buildWeightedStudentTotals(marks)
    expect(totals.ca).toBeCloseTo(25)
  })

  it("sets caMidTerm as ca + midTerm", () => {
    const totals = buildWeightedStudentTotals(marks)
    expect(totals.caMidTerm).toBeCloseTo(totals.ca + totals.midTerm)
  })

  it("returns all zeros for empty marks array", () => {
    const totals = buildWeightedStudentTotals([])
    expect(totals.overall).toBe(0)
    expect(totals.ca).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computeMetricStats
// ---------------------------------------------------------------------------
describe("computeMetricStats", () => {
  it("returns empty stats for an empty values array", () => {
    const stats = computeMetricStats([], 100)
    expect(stats.avg).toBe(0)
    expect(stats.outOf).toBe(100)
  })

  it("computes average correctly", () => {
    const stats = computeMetricStats([60, 70, 80], 100)
    expect(stats.avg).toBeCloseTo(70, 2)
  })

  it("computes median for odd-length array", () => {
    const stats = computeMetricStats([10, 50, 90], 100)
    expect(stats.median).toBe(50)
  })

  it("computes median for even-length array", () => {
    const stats = computeMetricStats([10, 20, 30, 40], 100)
    expect(stats.median).toBe(25)
  })

  it("computes mode for values with a clear winner", () => {
    const stats = computeMetricStats([10, 20, 20, 30], 100)
    expect(stats.mode).toBe(20)
  })

  it("returns N/A for mode when all values appear once with more than one value", () => {
    const stats = computeMetricStats([10, 20, 30], 100)
    expect(stats.mode).toBe("N/A")
  })

  it("returns the single value as mode for a single-element array", () => {
    const stats = computeMetricStats([42], 100)
    expect(stats.mode).toBe(42)
  })

  it("computes max and min correctly", () => {
    const stats = computeMetricStats([5, 15, 10], 20)
    expect(stats.max).toBe(15)
    expect(stats.min).toBe(5)
  })

  it("computes stdDev for uniform values as 0", () => {
    const stats = computeMetricStats([50, 50, 50], 100)
    expect(stats.stdDev).toBe(0)
  })

  it("computes non-zero stdDev for spread values", () => {
    const stats = computeMetricStats([0, 100], 100)
    expect(stats.stdDev).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// buildAnalyticsComponentFilters
// ---------------------------------------------------------------------------
describe("buildAnalyticsComponentFilters", () => {
  const assessments: AssessmentLike[] = [
    { code: "QZ1", name: "Quiz 1", category: "QUIZ", weightage: 10, maxMarks: 10 },
    { code: "MT1", name: "Mid Term", category: "MID", weightage: 25, maxMarks: 25 },
  ]

  it("always includes the ALL option", () => {
    const filters = buildAnalyticsComponentFilters(assessments)
    expect(filters.some((f) => f.key === "ALL")).toBe(true)
  })

  it("includes CA_QUIZ option when quiz assessments are present", () => {
    const filters = buildAnalyticsComponentFilters(assessments)
    expect(filters.some((f) => f.key === "CA_QUIZ")).toBe(true)
  })

  it("includes MID_TERM option when mid-term assessments are present", () => {
    const filters = buildAnalyticsComponentFilters(assessments)
    expect(filters.some((f) => f.key === "MID_TERM")).toBe(true)
  })

  it("excludes END_SEMESTER option when no end-semester assessments are present", () => {
    const filters = buildAnalyticsComponentFilters(assessments)
    expect(filters.some((f) => f.key === "END_SEMESTER")).toBe(false)
  })

  it("returns only the ALL option for an empty assessment list", () => {
    const filters = buildAnalyticsComponentFilters([])
    expect(filters).toHaveLength(1)
    expect(filters[0].key).toBe("ALL")
  })

  it("ALL option matcher always returns true", () => {
    const filters = buildAnalyticsComponentFilters(assessments)
    const allOption = filters.find((f) => f.key === "ALL")!
    expect(allOption.matcher(assessments[0])).toBe(true)
  })
})
