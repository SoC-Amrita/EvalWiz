export type GradeRuleBand = {
  id: string
  label: string
  minScore: number
}

export type GradeRule = {
  id: string
  name: string
  bands: GradeRuleBand[]
}

export type GradeRuleConfig = {
  selectedRuleId: string | null
  rules: GradeRule[]
}

export type GradeRuleIssue = {
  ruleId: string
  message: string
}

export type GradeRuleSectionCountRow = {
  bandId: string
  bandLabel: string
  minScore: number
  countBySectionId: Record<string, number>
  total: number
}

export type GradeRuleStudentScore = {
  studentId: string
  sectionId: string
  sectionName: string
  percentage: number
}

const DEFAULT_BANDS: Array<{ label: string; minScore: number }> = [
  { label: "O", minScore: 90 },
  { label: "A+", minScore: 80 },
  { label: "A", minScore: 73 },
  { label: "B+", minScore: 60 },
  { label: "B", minScore: 50 },
  { label: "C", minScore: 46 },
  { label: "P", minScore: 40 },
  { label: "F", minScore: 0 },
]

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Number(value.toFixed(2))))
}

function normalizeLabel(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function normalizeRuleName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function normalizeBand(input: unknown, index: number): GradeRuleBand {
  const fallback = DEFAULT_BANDS[index] ?? { label: `Grade ${index + 1}`, minScore: 0 }
  const band = input && typeof input === "object" ? (input as Partial<GradeRuleBand>) : {}

  return {
    id:
      typeof band.id === "string" && band.id.trim().length > 0
        ? band.id
        : `band-${index + 1}`,
    label: normalizeLabel(band.label, fallback.label),
    minScore: clampScore(typeof band.minScore === "number" ? band.minScore : fallback.minScore),
  }
}

export function createDefaultGradeRule(ruleId: string, name: string): GradeRule {
  return {
    id: ruleId,
    name,
    bands: DEFAULT_BANDS.map((band, index) => ({
      id: `${ruleId}-band-${index + 1}`,
      label: band.label,
      minScore: band.minScore,
    })),
  }
}

export function createEmptyGradeRuleConfig(): GradeRuleConfig {
  return {
    selectedRuleId: null,
    rules: [],
  }
}

export function createDefaultGradeRuleConfig(): GradeRuleConfig {
  const defaultRule = createDefaultGradeRule("rule-1", "Course Grade Rule")

  return {
    selectedRuleId: defaultRule.id,
    rules: [defaultRule],
  }
}

export function sanitizeGradeRule(rule: unknown, index: number): GradeRule {
  const fallback = createDefaultGradeRule(`rule-${index + 1}`, `Rule ${index + 1}`)
  const input = rule && typeof rule === "object" ? (rule as Partial<GradeRule>) : {}
  const rawBands = Array.isArray(input.bands) ? input.bands : fallback.bands

  return {
    id:
      typeof input.id === "string" && input.id.trim().length > 0
        ? input.id
        : fallback.id,
    name: normalizeRuleName(input.name, fallback.name),
    bands: rawBands.map((band, bandIndex) => normalizeBand(band, bandIndex)),
  }
}

export function sanitizeGradeRuleConfig(input: unknown): GradeRuleConfig {
  const fallback = createEmptyGradeRuleConfig()
  const raw = input && typeof input === "object" ? (input as Partial<GradeRuleConfig>) : {}
  const rules =
    Array.isArray(raw.rules) && raw.rules.length > 0
      ? raw.rules.map((rule, index) => sanitizeGradeRule(rule, index))
      : []

  const selectedRuleId =
    typeof raw.selectedRuleId === "string" && rules.some((rule) => rule.id === raw.selectedRuleId)
      ? raw.selectedRuleId
      : rules[0]?.id ?? fallback.selectedRuleId

  return {
    selectedRuleId,
    rules,
  }
}

export function getActiveGradeRule(config: GradeRuleConfig) {
  return config.rules.find((rule) => rule.id === config.selectedRuleId) ?? config.rules[0] ?? null
}

export function collapseGradeRuleConfigToActiveRule(input: unknown): GradeRuleConfig {
  const sanitized = sanitizeGradeRuleConfig(input)
  const activeRule = getActiveGradeRule(sanitized)

  if (!activeRule) {
    return createEmptyGradeRuleConfig()
  }

  return {
    selectedRuleId: activeRule.id,
    rules: [activeRule],
  }
}

export function parseGradeRuleConfig(value?: unknown) {
  if (!value) return createEmptyGradeRuleConfig()

  try {
    return collapseGradeRuleConfigToActiveRule(value)
  } catch {
    return createEmptyGradeRuleConfig()
  }
}

export function serializeGradeRuleConfig(config: GradeRuleConfig): GradeRuleConfig {
  return collapseGradeRuleConfigToActiveRule(config)
}

export function getGradeRuleIssues(rule: GradeRule): string[] {
  const issues: string[] = []

  if (rule.bands.length < 2) {
    issues.push("At least two grade bands are required.")
  }

  rule.bands.forEach((band, index) => {
    if (!band.label.trim()) {
      issues.push(`Band ${index + 1} needs a grade label.`)
    }

    if (band.minScore < 0 || band.minScore > 100) {
      issues.push(`${band.label || `Band ${index + 1}`} must stay between 0 and 100.`)
    }

    if (index > 0 && band.minScore >= rule.bands[index - 1].minScore) {
      issues.push(`${band.label || `Band ${index + 1}`} must be lower than the band above it.`)
    }
  })

  const lastBand = rule.bands[rule.bands.length - 1]
  if (lastBand && lastBand.minScore !== 0) {
    issues.push("The last grade band must start at 0 to cover every student.")
  }

  return issues
}

export function validateGradeRuleConfig(config: GradeRuleConfig): GradeRuleIssue[] {
  if (config.rules.length === 0) {
    return []
  }

  const issues = config.rules.flatMap((rule) =>
    getGradeRuleIssues(rule).map((message) => ({
      ruleId: rule.id,
      message,
    }))
  )

  if (!config.rules.some((rule) => rule.id === config.selectedRuleId)) {
    issues.push({
      ruleId: config.selectedRuleId ?? "unselected",
      message: "Choose an active rule for the dashboard.",
    })
  }

  return issues
}

export function getDerivedGradeBands(rule: GradeRule) {
  return rule.bands.map((band, index) => ({
    ...band,
    upperBound: index === 0 ? 100 : rule.bands[index - 1].minScore,
  }))
}

export function formatGradeBandUpperBound(rule: GradeRule, index: number) {
  if (index === 0) return "100"
  return `<${rule.bands[index - 1].minScore.toFixed(2).replace(/\.00$/, "")}`
}

export function resolveGradeBand(rule: GradeRule, percentage: number) {
  const clamped = clampScore(percentage)
  const match = rule.bands.find((band) => clamped >= band.minScore)
  return match ?? rule.bands[rule.bands.length - 1]
}

export function buildGradeRuleSectionRows(
  studentScores: GradeRuleStudentScore[],
  rule: GradeRule,
  sectionIds: string[]
): GradeRuleSectionCountRow[] {
  const rows = rule.bands.map((band) => ({
    bandId: band.id,
    bandLabel: band.label,
    minScore: band.minScore,
    countBySectionId: Object.fromEntries(sectionIds.map((sectionId) => [sectionId, 0])) as Record<string, number>,
    total: 0,
  }))

  const rowByBandId = new Map(rows.map((row) => [row.bandId, row]))

  studentScores.forEach((score) => {
    const band = resolveGradeBand(rule, score.percentage)
    const row = rowByBandId.get(band.id)
    if (!row) return

    row.countBySectionId[score.sectionId] = (row.countBySectionId[score.sectionId] ?? 0) + 1
    row.total += 1
  })

  return rows
}
