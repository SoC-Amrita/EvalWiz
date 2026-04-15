import { describe, expect, it } from "vitest"

import {
  buildGradeRuleSectionRows,
  collapseGradeRuleConfigToActiveRule,
  createDefaultGradeRule,
  createDefaultGradeRuleConfig,
  parseGradeRuleConfig,
  resolveGradeBand,
  sanitizeGradeRuleConfig,
  serializeGradeRuleConfig,
  validateGradeRuleConfig,
  type GradeRuleConfig,
} from "@/lib/grade-rules"

describe("grade rule config helpers", () => {
  it("falls back to a default config when parsing invalid JSON", () => {
    const config = parseGradeRuleConfig("{not-json")

    expect(config.rules).toHaveLength(0)
    expect(config.selectedRuleId).toBeNull()
  })

  it("round-trips a sanitized config through serialization", () => {
    const input: GradeRuleConfig = {
      selectedRuleId: "custom",
      rules: [
        {
          id: "custom",
          name: "Custom Rule",
          bands: [
            { id: "o", label: "O", minScore: 90 },
            { id: "f", label: "F", minScore: 0 },
          ],
        },
      ],
    }

    const serialized = serializeGradeRuleConfig(input)
    const parsed = parseGradeRuleConfig(serialized)

    expect(parsed).toEqual(input)
  })

  it("replaces missing rules with defaults", () => {
    const config = sanitizeGradeRuleConfig({ selectedRuleId: "missing", rules: [] })

    expect(config.rules).toHaveLength(0)
    expect(config.selectedRuleId).toBeNull()
  })

  it("keeps only the mentor-selected active rule", () => {
    const config = collapseGradeRuleConfigToActiveRule({
      selectedRuleId: "rule-2",
      rules: [
        createDefaultGradeRule("rule-1", "Rule 1"),
        createDefaultGradeRule("rule-2", "Rule 2"),
      ],
    })

    expect(config.selectedRuleId).toBe("rule-2")
    expect(config.rules).toHaveLength(1)
    expect(config.rules[0]?.id).toBe("rule-2")
  })
})

describe("validateGradeRuleConfig", () => {
  it("flags non-descending thresholds and missing zero coverage", () => {
    const config: GradeRuleConfig = {
      selectedRuleId: "rule-1",
      rules: [
        {
          id: "rule-1",
          name: "Broken Rule",
          bands: [
            { id: "o", label: "O", minScore: 90 },
            { id: "a", label: "A", minScore: 92 },
            { id: "f", label: "F", minScore: 10 },
          ],
        },
      ],
    }

    const issues = validateGradeRuleConfig(config)

    expect(issues.map((issue) => issue.message)).toContain("A must be lower than the band above it.")
    expect(issues.map((issue) => issue.message)).toContain(
      "The last grade band must start at 0 to cover every student."
    )
  })

  it("accepts the default configuration", () => {
    expect(validateGradeRuleConfig(createDefaultGradeRuleConfig())).toEqual([])
  })

  it("accepts a blank unpublished configuration", () => {
    expect(validateGradeRuleConfig({ selectedRuleId: null, rules: [] })).toEqual([])
  })
})

describe("resolveGradeBand", () => {
  const rule = createDefaultGradeRule("rule-1", "Rule 1")

  it("matches a score to the highest eligible band", () => {
    expect(resolveGradeBand(rule, 91).label).toBe("O")
    expect(resolveGradeBand(rule, 80).label).toBe("A+")
    expect(resolveGradeBand(rule, 39.9).label).toBe("F")
  })
})

describe("buildGradeRuleSectionRows", () => {
  it("counts students per section and total", () => {
    const rule = createDefaultGradeRule("rule-1", "Rule 1")
    const rows = buildGradeRuleSectionRows(
      [
        { studentId: "s1", sectionId: "A", sectionName: "A", percentage: 95 },
        { studentId: "s2", sectionId: "A", sectionName: "A", percentage: 82 },
        { studentId: "s3", sectionId: "B", sectionName: "B", percentage: 48 },
        { studentId: "s4", sectionId: "B", sectionName: "B", percentage: 20 },
      ],
      rule,
      ["A", "B"]
    )

    const byLabel = Object.fromEntries(rows.map((row) => [row.bandLabel, row]))

    expect(byLabel.O.total).toBe(1)
    expect(byLabel["A+"].countBySectionId.A).toBe(1)
    expect(byLabel.C.countBySectionId.B).toBe(1)
    expect(byLabel.F.countBySectionId.B).toBe(1)
  })
})
