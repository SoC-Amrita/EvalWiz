"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Copy, Save, ShieldAlert, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CHART_THEME, GRADE_BUCKET_COLORS, getSectionColor } from "@/lib/chart-theme"
import {
  buildGradeRuleSectionRows,
  createDefaultGradeRule,
  createEmptyGradeRuleConfig,
  formatGradeBandUpperBound,
  getDerivedGradeBands,
  getGradeRuleIssues,
  sanitizeGradeRuleConfig,
  validateGradeRuleConfig,
  type GradeRule,
  type GradeRuleConfig,
} from "@/lib/grade-rules"
import type { AdvancedAnalyticsExportMeta, SectionMeta } from "@/app/dashboard/advanced-analytics/types"
import type { FinalMarkStemPoint } from "@/app/dashboard/reports/types"

type SaveGradeRulesAction = (
  payload: GradeRuleConfig
) => Promise<{
  gradeRuleConfig: GradeRuleConfig
}>

type FinalScorePoint = FinalMarkStemPoint & {
  percentage: number
}

type StemLeafPoint = FinalScorePoint & {
  displayScore: number
  leaf: string
}

type HighlightKey = "ALL" | "GE90" | "80_89" | "70_79" | "60_69" | "50_59" | "LT50"

const HIGHLIGHT_OPTIONS: Array<{ key: HighlightKey; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "GE90", label: "90+" },
  { key: "80_89", label: "80-89" },
  { key: "70_79", label: "70-79" },
  { key: "60_69", label: "60-69" },
  { key: "50_59", label: "50-59" },
  { key: "LT50", label: "<50" },
]

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]

  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const lower = sorted[base]
  const upper = sorted[Math.min(base + 1, sorted.length - 1)]
  return lower + (upper - lower) * rest
}

function stats(values: number[]) {
  if (!values.length) {
    return {
      mean: 0,
      median: 0,
      q1: 0,
      q3: 0,
      min: 0,
      max: 0,
      stdDev: 0,
    }
  }

  const sorted = [...values].sort((left, right) => left - right)
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
  const variance =
    sorted.length > 1
      ? sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (sorted.length - 1)
      : 0

  return {
    mean: Number(mean.toFixed(2)),
    median: Number(quantile(sorted, 0.5).toFixed(2)),
    q1: Number(quantile(sorted, 0.25).toFixed(2)),
    q3: Number(quantile(sorted, 0.75).toFixed(2)),
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    stdDev: Number(Math.sqrt(variance).toFixed(2)),
  }
}

function histogram(values: number[], bins: number, min: number, max: number) {
  const safeMax = max <= min ? min + 1 : max
  const binSize = (safeMax - min) / bins

  const rows = Array.from({ length: bins }, (_, index) => {
    const start = min + index * binSize
    const end = min + (index + 1) * binSize

    return {
      label: `${formatNumber(start)}-${formatNumber(end)}`,
      count: 0,
    }
  })

  values.forEach((value) => {
    const clamped = Math.max(min, Math.min(value, safeMax))
    const index = Math.min(Math.floor((clamped - min) / binSize), rows.length - 1)
    rows[index].count += 1
  })

  return rows
}

function formatNumber(value: number) {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")
}

function createRuleCopy(baseRule: GradeRule, nextName: string): GradeRule {
  return {
    id: makeId("rule"),
    name: nextName,
    bands: baseRule.bands.map((band) => ({
      ...band,
      id: makeId("band"),
    })),
  }
}

function getHighlightKey(percentage: number): HighlightKey {
  if (percentage >= 90) return "GE90"
  if (percentage >= 80) return "80_89"
  if (percentage >= 70) return "70_79"
  if (percentage >= 60) return "60_69"
  if (percentage >= 50) return "50_59"
  return "LT50"
}

function buildStemRows(points: FinalScorePoint[], outOf: number) {
  const rows = new Map<number, StemLeafPoint[]>()

  points
    .map((point) => {
      const roundedScore = Math.round(point.score)
      const stem = Math.floor(roundedScore / 10)
      const leaf = String(roundedScore - stem * 10)

      return {
        ...point,
        displayScore: roundedScore,
        leaf,
      }
    })
    .sort((left, right) => left.displayScore - right.displayScore || left.rollNo.localeCompare(right.rollNo))
    .forEach((point) => {
      const stem = Math.floor(point.displayScore / 10)
      if (!rows.has(stem)) rows.set(stem, [])
      rows.get(stem)?.push(point)
    })

  return Array.from({ length: Math.floor(outOf / 10) + 1 }, (_, index) => ({
    stem: index,
    leaves: rows.get(index) ?? [],
  }))
}

function SimpleTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string | number
  payload?: Array<{ name?: string; value?: string | number; color?: string }>
}) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        backgroundColor: CHART_THEME.tooltipBackground,
        borderColor: CHART_THEME.tooltipBorder,
        color: CHART_THEME.tooltipForeground,
      }}
    >
      <p className="mb-1 text-sm font-semibold">{label}</p>
      {payload.map((entry, index) => (
        <div key={`${entry.name ?? "metric"}-${index}`} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color ?? CHART_THEME.axis }} />
          <span style={{ color: CHART_THEME.tooltipMuted }}>{entry.name}:</span>
          <span className="font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

function GradeRulesPanel({
  points,
  sections,
  canEdit,
  activeRoleView,
  initialConfig,
  saveGradeRulesAction,
}: {
  points: FinalScorePoint[]
  sections: SectionMeta[]
  canEdit: boolean
  activeRoleView: "administrator" | "mentor" | "faculty"
  initialConfig: GradeRuleConfig
  saveGradeRulesAction: SaveGradeRulesAction
}) {
  const [draftConfig, setDraftConfig] = useState(() => sanitizeGradeRuleConfig(initialConfig))
  const [isSaving, startSaving] = useTransition()

  useEffect(() => {
    setDraftConfig(sanitizeGradeRuleConfig(initialConfig))
  }, [initialConfig])

  const selectedRule =
    draftConfig.rules.find((rule) => rule.id === draftConfig.selectedRuleId) ?? draftConfig.rules[0]
  const issues = useMemo(() => validateGradeRuleConfig(draftConfig), [draftConfig])
  const issuesByRule = useMemo(
    () =>
      issues.reduce<Record<string, string[]>>((accumulator, issue) => {
        accumulator[issue.ruleId] = [...(accumulator[issue.ruleId] ?? []), issue.message]
        return accumulator
      }, {}),
    [issues]
  )

  const updateRule = (ruleId: string, updater: (rule: GradeRule) => GradeRule) => {
    setDraftConfig((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.id === ruleId ? updater(rule) : rule)),
    }))
  }

  const saveRules = () => {
    startSaving(async () => {
      try {
        const result = await saveGradeRulesAction(draftConfig)
        setDraftConfig(sanitizeGradeRuleConfig(result.gradeRuleConfig))
        toast.success("Grade rules saved for this course workspace")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save grade rules")
      }
    })
  }

  const sectionIds = sections.map((section) => section.id)
  const activeRows = selectedRule ? buildGradeRuleSectionRows(points, selectedRule, sectionIds) : []
  const activeTopBand = selectedRule?.bands[0]
  const activeBottomBand = selectedRule?.bands[selectedRule.bands.length - 1]
  const topBandRow = activeTopBand ? activeRows.find((row) => row.bandId === activeTopBand.id) : null
  const bottomBandRow = activeBottomBand
    ? activeRows.find((row) => row.bandId === activeBottomBand.id)
    : null
  const totalStudents = points.length

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Grade Rule Comparison</CardTitle>
              <CardDescription>
                Configure multiple grading rules side by side and choose which one powers the grading dashboard.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canEdit ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDraftConfig((current) => {
                        const nextRule =
                          current.rules.length === 0
                            ? createDefaultGradeRule("rule-1", "Rule 1")
                            : createRuleCopy(
                                current.rules[current.rules.length - 1],
                                `Rule ${current.rules.length + 1}`
                              )

                        return {
                          ...current,
                          rules: [...current.rules, nextRule],
                          selectedRuleId: current.selectedRuleId ?? nextRule.id,
                        }
                      })
                    }
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Add Rule
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDraftConfig(createEmptyGradeRuleConfig())}
                    disabled={isSaving || draftConfig.rules.length === 0}
                  >
                    Clear Rules
                  </Button>
                  <Button type="button" size="sm" onClick={saveRules} disabled={isSaving || issues.length > 0}>
                    <Save className="h-3.5 w-3.5" />
                    {isSaving ? "Saving..." : draftConfig.rules.length === 0 ? "Publish Blank State" : "Save Rules"}
                  </Button>
                </>
              ) : (
                <Badge variant="outline" className="chip-soft-neutral">
                  Read-only in {activeRoleView} view
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {canEdit ? (
              <span>Mentor mode is active. Save here to publish grading rules for everyone in this workspace.</span>
            ) : (
              <span>
                Only mentors can publish grading rules. Faculty and administrators can still review the saved rules and
                section-wise grade counts.
              </span>
            )}
          </div>

          {draftConfig.rules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background px-6 py-10 text-center">
              <div className="mx-auto max-w-2xl space-y-3">
                <h3 className="text-lg font-semibold text-foreground">No grade rules published yet</h3>
                <p className="text-sm text-muted-foreground">
                  This is expected until the mentor finalizes grading at the end of the semester. The score
                  distribution, section box plot, and stem-and-leaf chart below still stay available for review.
                </p>
                {canEdit ? (
                  <div className="flex justify-center gap-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        setDraftConfig({
                          selectedRuleId: "rule-1",
                          rules: [createDefaultGradeRule("rule-1", "Rule 1")],
                        })
                      }
                    >
                      Start First Rule
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {draftConfig.rules.map((rule, ruleIndex) => {
              const ruleRows = buildGradeRuleSectionRows(points, rule, sectionIds)
              const ruleIssues = issuesByRule[rule.id] ?? getGradeRuleIssues(rule)

              return (
                <Card key={rule.id} className="border-border bg-background shadow-none">
                  <CardHeader className="border-b border-border pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={draftConfig.selectedRuleId === rule.id ? "default" : "outline"}
                            onClick={() =>
                              setDraftConfig((current) => ({
                                ...current,
                                selectedRuleId: rule.id,
                              }))
                            }
                            className="h-7"
                          >
                            {draftConfig.selectedRuleId === rule.id ? "Active Dashboard Rule" : "Use for Dashboard"}
                          </Button>
                          <Badge variant="outline" className="chip-soft-primary">
                            {ruleRows.reduce((sum, row) => sum + row.total, 0)} students
                          </Badge>
                        </div>
                        <Input
                          value={rule.name}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateRule(rule.id, (current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                        />
                      </div>
                      {canEdit ? (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setDraftConfig((current) => ({
                                ...current,
                                rules: [
                                  ...current.rules,
                                  createRuleCopy(rule, `${rule.name} Copy`),
                                ],
                              }))
                            }
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Duplicate
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setDraftConfig((current) => {
                                const remaining = current.rules.filter((entry) => entry.id !== rule.id)
                                return {
                                  selectedRuleId:
                                    current.selectedRuleId === rule.id ? remaining[0]?.id ?? null : current.selectedRuleId,
                                  rules: remaining,
                                }
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Grade</TableHead>
                          <TableHead className="text-right">From</TableHead>
                          <TableHead className="text-right">To</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getDerivedGradeBands(rule).map((band, bandIndex) => {
                          const row = ruleRows.find((entry) => entry.bandId === band.id)
                          return (
                            <TableRow key={band.id}>
                              <TableCell className="min-w-28">
                                <Input
                                  value={band.label}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    updateRule(rule.id, (current) => ({
                                      ...current,
                                      bands: current.bands.map((entry) =>
                                        entry.id === band.id ? { ...entry, label: event.target.value } : entry
                                      ),
                                    }))
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="100"
                                  value={band.minScore}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    updateRule(rule.id, (current) => ({
                                      ...current,
                                      bands: current.bands.map((entry) =>
                                        entry.id === band.id
                                          ? { ...entry, minScore: Number(event.target.value || 0) }
                                          : entry
                                      ),
                                    }))
                                  }
                                  className="ml-auto w-24 text-right"
                                />
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">
                                {formatGradeBandUpperBound(rule, bandIndex)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-foreground">
                                {row?.total ?? 0}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    {ruleIssues.length > 0 ? (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                        <div className="mb-2 flex items-center gap-2 font-medium">
                          <ShieldAlert className="h-4 w-4" />
                          Fix these rule issues before saving
                        </div>
                        <ul className="space-y-1">
                          {ruleIssues.map((message) => (
                            <li key={`${rule.id}-${message}`}>{message}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <StatPill
                        label={rule.bands[0]?.label ?? "Top"}
                        value={String(ruleRows[0]?.total ?? 0)}
                      />
                      <StatPill
                        label={rule.bands[rule.bands.length - 1]?.label ?? "Bottom"}
                        value={String(ruleRows[ruleRows.length - 1]?.total ?? 0)}
                      />
                      <StatPill label="Rule" value={`#${ruleIndex + 1}`} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          )}
        </CardContent>
      </Card>

      {selectedRule ? (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle>Grading Dashboard</CardTitle>
            <CardDescription>
              {`Section-wise grade counts and cohort totals for ${selectedRule.name}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard label="Students in scope" value={totalStudents.toLocaleString()} helper="Students included in the dashboard" />
              <StatCard
                label={activeTopBand?.label ?? "Top band"}
                value={String(topBandRow?.total ?? 0)}
                helper="Students in the highest grade band"
              />
              <StatCard
                label={activeBottomBand?.label ?? "Bottom band"}
                value={String(bottomBandRow?.total ?? 0)}
                helper="Students in the lowest grade band"
              />
              <StatCard
                label="Passing share"
                value={
                  totalStudents > 0
                    ? `${(((totalStudents - (bottomBandRow?.total ?? 0)) / totalStudents) * 100).toFixed(1)}%`
                    : "0%"
                }
                helper={`Treating ${activeBottomBand?.label ?? "last band"} as the lowest bucket`}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">From</TableHead>
                      <TableHead className="text-right">To</TableHead>
                      {sections.map((section) => (
                        <TableHead key={section.id} className="text-center">
                          {section.name}
                        </TableHead>
                      ))}
                      <TableHead className="text-center">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedRule.bands.map((band, index) => {
                      const row = activeRows.find((entry) => entry.bandId === band.id)
                      return (
                        <TableRow key={band.id}>
                          <TableCell className="font-semibold">{band.label}</TableCell>
                          <TableCell className="text-right font-mono">{formatNumber(band.minScore)}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {formatGradeBandUpperBound(selectedRule, index)}
                          </TableCell>
                          {sections.map((section) => (
                            <TableCell key={`${band.id}-${section.id}`} className="text-center font-mono">
                              {row?.countBySectionId[section.id] ?? 0}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-semibold">{row?.total ?? 0}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <Card className="border-border bg-background shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Grade Window Distribution</CardTitle>
                  <CardDescription>Total students in each band for the selected rule</CardDescription>
                </CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={selectedRule.bands.map((band, index) => ({
                        label: band.label,
                        count: activeRows.find((row) => row.bandId === band.id)?.total ?? 0,
                        fill: GRADE_BUCKET_COLORS[index % GRADE_BUCKET_COLORS.length],
                      }))}
                      margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_THEME.grid} opacity={0.2} />
                      <XAxis dataKey="label" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<SimpleTooltip />} cursor={{ fill: CHART_THEME.cursor }} />
                      <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                        {selectedRule.bands.map((band, index) => (
                          <Cell key={band.id} fill={GRADE_BUCKET_COLORS[index % GRADE_BUCKET_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle>Grading Dashboard</CardTitle>
            <CardDescription>
              Grade rules have not been published yet for this offering.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="rounded-xl border border-dashed border-border bg-muted/40 p-5 text-sm text-muted-foreground">
              The mentor can keep the grading dashboard blank until the end of the semester. Once a rule is published,
              section-wise grade counts and band distributions will appear here.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  )
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <Card className="border-border bg-background shadow-none">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

function FinalScoreDistribution({
  points,
  outOf,
}: {
  points: FinalScorePoint[]
  outOf: number
}) {
  const bins = histogram(
    points.map((point) => point.score),
    Math.max(6, Math.min(12, Math.round(Math.sqrt(points.length || 1)))),
    0,
    outOf
  )
  const summary = stats(points.map((point) => point.score))

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border">
        <CardTitle>Final Score Distribution</CardTitle>
        <CardDescription>Overall weighted totals across the full course grading scale.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Mean" value={formatNumber(summary.mean)} helper={`Out of ${formatNumber(outOf)}`} />
          <StatCard label="Median" value={formatNumber(summary.median)} helper="Middle final score" />
          <StatCard label="Std. Dev." value={formatNumber(summary.stdDev)} helper="Spread of final marks" />
          <StatCard label="Students" value={points.length.toLocaleString()} helper="Visible student records" />
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bins} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_THEME.grid} opacity={0.2} />
              <XAxis dataKey="label" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<SimpleTooltip />} cursor={{ fill: CHART_THEME.cursor }} />
              <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]} fill={GRADE_BUCKET_COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function FinalScoreBoxWhisker({
  points,
  sections,
  outOf,
}: {
  points: FinalScorePoint[]
  sections: SectionMeta[]
  outOf: number
}) {
  const boxData = sections
    .map((section, index) => {
      const values = points
        .filter((point) => point.sectionId === section.id)
        .map((point) => point.score)

      return {
        section,
        color: getSectionColor(index),
        values,
        summary: stats(values),
      }
    })
    .filter((entry) => entry.values.length > 0)

  const width = Math.max(860, 160 + Math.max(boxData.length - 1, 1) * 110)
  const chartLeft = 88
  const chartRight = width - 72
  const step = boxData.length > 1 ? (chartRight - chartLeft) / (boxData.length - 1) : 0
  const ticks = Array.from({ length: 6 }, (_, index) => Number(((index / 5) * outOf).toFixed(0)))

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border">
        <CardTitle>Section Box &amp; Whisker Plot</CardTitle>
        <CardDescription>Final weighted scores by section, with quartiles and mean.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-6">
        <svg width={width} height={360} className="mx-auto">
          <line x1={chartLeft} y1={20} x2={chartLeft} y2={300} stroke={CHART_THEME.grid} strokeWidth={1} />
          <line x1={chartLeft} y1={300} x2={chartRight + 12} y2={300} stroke={CHART_THEME.grid} strokeWidth={1} />
          {ticks.map((value) => {
            const y = 20 + (1 - value / outOf) * 280
            return (
              <g key={value}>
                <line x1={chartLeft - 4} y1={y} x2={chartRight + 12} y2={y} stroke={CHART_THEME.grid} strokeDasharray="4 4" />
                <text x={58} y={y + 4} textAnchor="end" fontSize={10} fill={CHART_THEME.axis}>
                  {value}
                </text>
              </g>
            )
          })}
          {boxData.map((entry, index) => {
            const centerX = boxData.length === 1 ? (chartLeft + chartRight) / 2 : chartLeft + index * step
            const boxWidth = 50
            const toY = (value: number) => 20 + (1 - value / outOf) * 280

            return (
              <g key={entry.section.id}>
                <line x1={centerX} y1={toY(entry.summary.max)} x2={centerX} y2={toY(entry.summary.q3)} stroke={entry.color} strokeWidth={2} />
                <line x1={centerX} y1={toY(entry.summary.min)} x2={centerX} y2={toY(entry.summary.q1)} stroke={entry.color} strokeWidth={2} />
                <line x1={centerX - 10} y1={toY(entry.summary.max)} x2={centerX + 10} y2={toY(entry.summary.max)} stroke={entry.color} strokeWidth={2} />
                <line x1={centerX - 10} y1={toY(entry.summary.min)} x2={centerX + 10} y2={toY(entry.summary.min)} stroke={entry.color} strokeWidth={2} />
                <rect
                  x={centerX - boxWidth / 2}
                  y={toY(entry.summary.q3)}
                  width={boxWidth}
                  height={Math.max(2, Math.abs(toY(entry.summary.q1) - toY(entry.summary.q3)))}
                  fill={entry.color}
                  fillOpacity={0.18}
                  stroke={entry.color}
                  strokeWidth={2}
                  rx={4}
                />
                <line x1={centerX - boxWidth / 2} y1={toY(entry.summary.median)} x2={centerX + boxWidth / 2} y2={toY(entry.summary.median)} stroke={entry.color} strokeWidth={3} />
                <circle cx={centerX} cy={toY(entry.summary.mean)} r={4} fill={entry.color} />
                <text x={centerX} y={320} textAnchor="middle" fontSize={11} fill={CHART_THEME.axis}>
                  {entry.section.name}
                </text>
                <text x={centerX} y={334} textAnchor="middle" fontSize={9} fill={CHART_THEME.axis}>
                  n={entry.values.length}
                </text>
              </g>
            )
          })}
        </svg>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Box = interquartile range, horizontal line = median, dot = mean
        </p>
      </CardContent>
    </Card>
  )
}

function StemLeafChart({
  points,
  outOf,
  sections,
}: {
  points: FinalScorePoint[]
  outOf: number
  sections: SectionMeta[]
}) {
  const [selectedSectionId, setSelectedSectionId] = useState("ALL")
  const [showRollNumbers, setShowRollNumbers] = useState(false)
  const [hideEmptyStems, setHideEmptyStems] = useState(true)
  const [highlightRange, setHighlightRange] = useState<HighlightKey>("ALL")

  const visiblePoints = useMemo(
    () => (selectedSectionId === "ALL" ? points : points.filter((point) => point.sectionId === selectedSectionId)),
    [points, selectedSectionId]
  )

  const rows = useMemo(() => buildStemRows(visiblePoints, outOf), [outOf, visiblePoints])

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border">
        <CardTitle>Stem-and-Leaf Chart</CardTitle>
        <CardDescription>Final weighted scores arranged exactly for grading review conversations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Section</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={selectedSectionId === "ALL" ? "default" : "outline"} onClick={() => setSelectedSectionId("ALL")}>
                  All sections
                </Button>
                {sections.map((section) => (
                  <Button
                    key={section.id}
                    type="button"
                    size="sm"
                    variant={selectedSectionId === section.id ? "default" : "outline"}
                    onClick={() => setSelectedSectionId(section.id)}
                  >
                    {section.name}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Highlight</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {HIGHLIGHT_OPTIONS.map((option) => (
                  <Button
                    key={option.key}
                    type="button"
                    size="sm"
                    variant={highlightRange === option.key ? "default" : "outline"}
                    onClick={() => setHighlightRange(option.key)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {[
                {
                  label: "Show roll numbers",
                  checked: showRollNumbers,
                  onChange: () => setShowRollNumbers((current) => !current),
                },
                {
                  label: "Hide empty stems",
                  checked: hideEmptyStems,
                  onChange: () => setHideEmptyStems((current) => !current),
                },
              ].map((control) => (
                <label key={control.label} className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-3 text-sm">
                  <span>{control.label}</span>
                  <input type="checkbox" checked={control.checked} onChange={control.onChange} className="h-4 w-4 rounded border-slate-300" />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] border-b border-border bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <div>Stem</div>
              <div>Leaves</div>
            </div>
            <div className="divide-y divide-border">
              {(hideEmptyStems ? rows.filter((row) => row.leaves.length > 0) : rows).map((row) => (
                <div key={row.stem} className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 px-5 py-4">
                  <div className="font-mono text-2xl font-semibold text-foreground">{row.stem}</div>
                  <div className="flex flex-wrap gap-2.5">
                    {row.leaves.length > 0 ? (
                      row.leaves.map((point) => {
                        const pointHighlight = getHighlightKey(point.percentage)
                        const isDimmed = highlightRange !== "ALL" && pointHighlight !== highlightRange
                        const color = GRADE_BUCKET_COLORS[HIGHLIGHT_OPTIONS.findIndex((option) => option.key === pointHighlight) % GRADE_BUCKET_COLORS.length]

                        return (
                          <span
                            key={`${point.studentId}-${point.displayScore}`}
                            title={`${point.rollNo} · ${point.sectionName} · ${formatNumber(point.score)} / ${formatNumber(point.outOf)}`}
                            className={`inline-flex min-w-10 items-center justify-center gap-1 rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold shadow-sm ${isDimmed ? "opacity-25 grayscale" : ""}`}
                            style={{
                              borderColor: color,
                              color,
                              background: `color-mix(in srgb, ${color} 14%, var(--card))`,
                            }}
                          >
                            <span>{point.leaf}</span>
                            {showRollNumbers ? <span className="text-[10px] opacity-70">{point.rollNo}</span> : null}
                          </span>
                        )
                      })
                    ) : (
                      <span className="text-sm text-muted-foreground">No leaves</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Key: <span className="font-mono font-semibold text-foreground">7 | 4</span> means 74 out of {formatNumber(outOf)}.
        </p>
      </CardContent>
    </Card>
  )
}

export function GradingClient({
  exportMeta,
  sections,
  finalMarkStemData,
  activeRoleView,
  canEditGradeRules,
  initialGradeRuleConfig,
  saveGradeRulesAction,
}: {
  exportMeta: AdvancedAnalyticsExportMeta
  sections: SectionMeta[]
  finalMarkStemData: FinalMarkStemPoint[]
  activeRoleView: "administrator" | "mentor" | "faculty"
  canEditGradeRules: boolean
  initialGradeRuleConfig: GradeRuleConfig
  saveGradeRulesAction: SaveGradeRulesAction
}) {
  const finalPoints = useMemo<FinalScorePoint[]>(
    () =>
      finalMarkStemData.map((point) => ({
        ...point,
        percentage: point.outOf > 0 ? (point.score / point.outOf) * 100 : 0,
      })),
    [finalMarkStemData]
  )

  const outOf = finalPoints[0]?.outOf ?? 100
  const overallStats = useMemo(() => stats(finalPoints.map((point) => point.score)), [finalPoints])
  const normalizedRuleConfig = useMemo(() => sanitizeGradeRuleConfig(initialGradeRuleConfig), [initialGradeRuleConfig])
  const savedRule = useMemo(
    () =>
      normalizedRuleConfig.rules.find((rule) => rule.id === normalizedRuleConfig.selectedRuleId) ??
      normalizedRuleConfig.rules[0],
    [normalizedRuleConfig]
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subject" value={exportMeta.subjectCode} helper={exportMeta.subjectTitle} />
        <StatCard label="Students" value={finalPoints.length.toLocaleString()} helper="Final-score records available" />
        <StatCard label="Sections" value={sections.length.toLocaleString()} helper="Sections in the selected offering" />
        <StatCard
          label="Current rule"
          value={savedRule?.name ?? "Rule 1"}
          helper={canEditGradeRules ? "Mentor-managed" : "Mentor-managed, read-only here"}
        />
      </div>

      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle>Grading Workspace</CardTitle>
          <CardDescription>
            Workbook-style grading review for {exportMeta.subjectCode} · {exportMeta.subjectTitle}. This page groups the
            configurable grade rules, section comparison charts, and stem-and-leaf review into one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
          <StatPill label="Mean final score" value={`${formatNumber(overallStats.mean)} / ${formatNumber(outOf)}`} />
          <StatPill label="Median final score" value={`${formatNumber(overallStats.median)} / ${formatNumber(outOf)}`} />
          <StatPill label="Std. dev." value={formatNumber(overallStats.stdDev)} />
          <StatPill label="Role view" value={activeRoleView} />
        </CardContent>
      </Card>

      <GradeRulesPanel
        points={finalPoints}
        sections={sections}
        canEdit={canEditGradeRules}
        activeRoleView={activeRoleView}
        initialConfig={normalizedRuleConfig}
        saveGradeRulesAction={saveGradeRulesAction}
      />

      <FinalScoreDistribution points={finalPoints} outOf={outOf} />
      <FinalScoreBoxWhisker points={finalPoints} sections={sections} outOf={outOf} />
      <StemLeafChart points={finalPoints} outOf={outOf} sections={sections} />
    </div>
  )
}
