"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowLeft, ArrowUpRight } from "lucide-react"

import type { SectionMeta } from "@/app/dashboard/advanced-analytics/types"
import type { FinalMarkStemPoint } from "@/app/dashboard/reports/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { CHART_THEME, GRADE_BUCKET_COLORS, getSectionColor } from "@/lib/chart-theme"
import { cn } from "@/lib/utils"

type StemLeafUnit = 1 | 0.5
type StemLeafSortMode = "score" | "section"
type HighlightKey = "ALL" | "LT50" | "50_59" | "60_69" | "70_79" | "80_89" | "GE90"

type StemLeafPoint = FinalMarkStemPoint & {
  displayScore: number
  leaf: string
}

const HIGHLIGHT_OPTIONS: Array<{ key: HighlightKey; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "LT50", label: "<50" },
  { key: "50_59", label: "50-59" },
  { key: "60_69", label: "60-69" },
  { key: "70_79", label: "70-79" },
  { key: "80_89", label: "80-89" },
  { key: "GE90", label: "90+" },
]

function formatNumber(value: number) {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getHighlightKey(score: number, outOf: number): HighlightKey {
  const percentage = outOf > 0 ? (score / outOf) * 100 : 0
  if (percentage >= 90) return "GE90"
  if (percentage >= 80) return "80_89"
  if (percentage >= 70) return "70_79"
  if (percentage >= 60) return "60_69"
  if (percentage >= 50) return "50_59"
  return "LT50"
}

function getHighlightColor(score: number, outOf: number) {
  const range = getHighlightKey(score, outOf)
  if (range === "GE90") return "var(--chart-1)"
  if (range === "80_89") return "var(--chart-3)"
  if (range === "70_79") return "var(--chart-6)"
  if (range === "60_69") return "var(--chart-4)"
  if (range === "50_59") return "var(--chart-7)"
  return GRADE_BUCKET_COLORS[0] ?? "var(--destructive)"
}

function buildStemLeafRows(
  points: FinalMarkStemPoint[],
  unit: StemLeafUnit,
  sortMode: StemLeafSortMode,
  hideEmptyStems: boolean,
  outOf: number
) {
  const rows = new Map<number, StemLeafPoint[]>()

  points
    .map((point) => {
      const roundedScore = Math.round(point.score / unit) * unit
      const stem = Math.floor(roundedScore / 10)
      const remainder = roundedScore - stem * 10
      const leaf = unit === 1 ? Math.round(remainder).toString() : remainder.toFixed(1).replace(/\.0$/, "")

      return {
        ...point,
        leaf,
        displayScore: roundedScore,
      }
    })
    .sort((left, right) => {
      if (sortMode === "section") {
        return (
          left.sectionName.localeCompare(right.sectionName) ||
          left.displayScore - right.displayScore ||
          left.rollNo.localeCompare(right.rollNo)
        )
      }

      return left.displayScore - right.displayScore || left.rollNo.localeCompare(right.rollNo)
    })
    .forEach((point) => {
      const stem = Math.floor(point.displayScore / 10)
      if (!rows.has(stem)) rows.set(stem, [])
      rows.get(stem)?.push(point)
    })

  const stems = hideEmptyStems
    ? [...rows.keys()].sort((left, right) => left - right)
    : Array.from({ length: Math.floor(outOf / 10) + 1 }, (_, index) => index)

  return stems.map((stem) => ({
    stem,
    leaves: rows.get(stem) ?? [],
  }))
}

function buildSectionEntries(points: FinalMarkStemPoint[], sections: SectionMeta[]) {
  const sectionMap = new Map(sections.map((section) => [section.id, section.name]))

  points.forEach((point) => {
    if (!sectionMap.has(point.sectionId)) {
      sectionMap.set(point.sectionId, point.sectionName)
    }
  })

  return Array.from(sectionMap.entries())
}

export function StemLeafOverviewCard({
  points,
  sections,
}: {
  points: FinalMarkStemPoint[]
  sections: SectionMeta[]
}) {
  const chart = useMemo(() => {
    const sortedPoints = [...points].sort((left, right) => left.score - right.score)
    const sectionEntries = buildSectionEntries(points, sections)
    const colorBySection = new Map(
      sectionEntries.map(([sectionId], index) => [sectionId, getSectionColor(index)])
    )
    const outOf = sortedPoints[0]?.outOf || 100
    const leftPadding = 52
    const rightPadding = 24
    const topPadding = 20
    const bottomPadding = 42
    const stemSpacing = sortedPoints.length > 72 ? 12 : sortedPoints.length > 44 ? 16 : 22
    const width = Math.max(720, leftPadding + rightPadding + Math.max(sortedPoints.length - 1, 1) * stemSpacing)
    const height = 320
    const plotHeight = height - topPadding - bottomPadding
    const baselineY = topPadding + plotHeight

    const chartPoints = sortedPoints.map((point, index) => {
      const x = leftPadding + index * stemSpacing
      const y = topPadding + (1 - Math.min(point.score, outOf) / outOf) * plotHeight
      return {
        ...point,
        x,
        y,
        color: colorBySection.get(point.sectionId) ?? "var(--primary)",
      }
    })

    return {
      chartPoints,
      sectionEntries,
      colorBySection,
      outOf,
      width,
      height,
      leftPadding,
      rightPadding,
      topPadding,
      bottomPadding,
      plotHeight,
      baselineY,
      meanScore: average(points.map((point) => point.score)),
    }
  }, [points, sections])

  if (points.length === 0) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle>Stem Chart</CardTitle>
          <CardDescription>Final marks will appear here once weighted totals are available.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const ticks = [0, 25, 50, 75, 100].map((percentage) => Number(((chart.outOf * percentage) / 100).toFixed(1)))
  const meanY = chart.topPadding + (1 - Math.min(chart.meanScore, chart.outOf) / chart.outOf) * chart.plotHeight

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Stem Chart</CardTitle>
          <CardDescription>
            A quick view of final totals. Click the graph to open the full stem-and-leaf explorer with filters and
            grading controls.
          </CardDescription>
        </div>
        <Link
          href="/dashboard/grading/stem-leaf"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
        >
          Open Explorer
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <Link
          href="/dashboard/grading/stem-leaf"
          className="block overflow-hidden rounded-2xl border border-border bg-muted/20 transition hover:border-primary/40 hover:bg-muted/35"
        >
          <div className="overflow-x-auto p-4">
            <svg
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              width={chart.width}
              height={chart.height}
              role="img"
              aria-label="Stem chart showing student final marks"
              className="max-w-none"
            >
              <line
                x1={chart.leftPadding}
                x2={chart.width - chart.rightPadding}
                y1={chart.baselineY}
                y2={chart.baselineY}
                stroke={CHART_THEME.grid}
                strokeWidth="1.5"
              />
              {ticks.map((tick) => {
                const y = chart.topPadding + (1 - tick / chart.outOf) * chart.plotHeight
                return (
                  <g key={tick}>
                    <line
                      x1={chart.leftPadding}
                      x2={chart.width - chart.rightPadding}
                      y1={y}
                      y2={y}
                      stroke={CHART_THEME.grid}
                      strokeDasharray="4 5"
                      opacity="0.45"
                    />
                    <text x={chart.leftPadding - 10} y={y + 4} textAnchor="end" fontSize="11" fill={CHART_THEME.axis}>
                      {tick}
                    </text>
                  </g>
                )
              })}
              <line
                x1={chart.leftPadding}
                x2={chart.width - chart.rightPadding}
                y1={meanY}
                y2={meanY}
                stroke="var(--primary)"
                strokeDasharray="6 6"
                strokeWidth="1.5"
                opacity="0.72"
              />
              <text
                x={chart.width - chart.rightPadding}
                y={meanY - 6}
                textAnchor="end"
                fontSize="11"
                fill="var(--primary)"
                fontWeight="600"
              >
                Mean {chart.meanScore.toFixed(1)}
              </text>
              {chart.chartPoints.map((point) => (
                <g key={`${point.studentId}-${point.sectionId}`}>
                  <line
                    x1={point.x}
                    x2={point.x}
                    y1={chart.baselineY}
                    y2={point.y}
                    stroke={point.color}
                    strokeWidth="1.5"
                    opacity="0.44"
                  />
                  <circle cx={point.x} cy={point.y} r="4.2" fill={point.color} stroke="var(--card)" strokeWidth="1.4">
                    <title>
                      {`${point.rollNo} · ${point.studentName}\n${point.sectionName}\nFinal: ${point.score.toFixed(1)} / ${point.outOf}`}
                    </title>
                  </circle>
                </g>
              ))}
              <text x={chart.leftPadding} y={chart.height - 10} fontSize="11" fill={CHART_THEME.axis}>
                Lower final totals
              </text>
              <text
                x={chart.width - chart.rightPadding}
                y={chart.height - 10}
                textAnchor="end"
                fontSize="11"
                fill={CHART_THEME.axis}
              >
                Higher final totals
              </text>
            </svg>
          </div>
        </Link>
        <div className="flex flex-wrap gap-2">
          {chart.sectionEntries.map(([sectionId, sectionName]) => (
            <span
              key={sectionId}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: chart.colorBySection.get(sectionId) ?? "var(--primary)" }}
              />
              {sectionName}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function StemLeafExplorerPage({
  points,
  sections,
  subjectLabel,
}: {
  points: FinalMarkStemPoint[]
  sections: SectionMeta[]
  subjectLabel: string
}) {
  const sectionEntries = useMemo(() => buildSectionEntries(points, sections), [points, sections])
  const colorBySection = useMemo(
    () => new Map(sectionEntries.map(([sectionId], index) => [sectionId, getSectionColor(index)])),
    [sectionEntries]
  )
  const outOf = points[0]?.outOf ?? 100

  const [unit, setUnit] = useState<StemLeafUnit>(1)
  const [selectedSectionId, setSelectedSectionId] = useState("ALL")
  const [sortMode, setSortMode] = useState<StemLeafSortMode>("score")
  const [showRollNumbers, setShowRollNumbers] = useState(false)
  const [highlightRange, setHighlightRange] = useState<HighlightKey>("ALL")
  const [hideEmptyStems, setHideEmptyStems] = useState(true)
  const [sectionComparisonMode, setSectionComparisonMode] = useState(false)

  const visiblePoints = useMemo(
    () =>
      selectedSectionId === "ALL"
        ? points
        : points.filter((point) => point.sectionId === selectedSectionId),
    [points, selectedSectionId]
  )

  const stemGroups = useMemo(() => {
    if (sectionComparisonMode) {
      const visibleSectionIds = new Set(visiblePoints.map((point) => point.sectionId))
      return sectionEntries
        .filter(([sectionId]) => visibleSectionIds.has(sectionId))
        .map(([sectionId, sectionName]) => ({
          id: sectionId,
          name: sectionName,
          rows: buildStemLeafRows(
            visiblePoints.filter((point) => point.sectionId === sectionId),
            unit,
            sortMode,
            hideEmptyStems,
            outOf
          ),
        }))
    }

    const selectedSectionName =
      selectedSectionId === "ALL"
        ? "All selected sections"
        : sectionEntries.find(([sectionId]) => sectionId === selectedSectionId)?.[1] ?? "Selected section"

    return [
      {
        id: selectedSectionId,
        name: selectedSectionName,
        rows: buildStemLeafRows(visiblePoints, unit, sortMode, hideEmptyStems, outOf),
      },
    ]
  }, [hideEmptyStems, outOf, sectionComparisonMode, sectionEntries, selectedSectionId, sortMode, unit, visiblePoints])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Grading</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Stem-and-Leaf Explorer
          </h1>
          <p className="mt-1 text-slate-500">
            Detailed final-score review for {subjectLabel}. Use this space to inspect leaf granularity, compare
            sections, and zoom in on specific score bands.
          </p>
        </div>
        <Link
          href="/dashboard/grading"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Grading
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Visible students</CardDescription>
            <CardTitle className="text-2xl">{visiblePoints.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Leaf granularity</CardDescription>
            <CardTitle className="text-2xl">{unit === 1 ? "Whole marks" : "Half marks"}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Current section focus</CardDescription>
            <CardTitle className="text-2xl">
              {selectedSectionId === "ALL"
                ? "All sections"
                : sectionEntries.find(([sectionId]) => sectionId === selectedSectionId)?.[1] ?? "Selected section"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-2xl border border-border bg-muted/25 p-4 lg:sticky lg:top-8 lg:self-start">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Section</div>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => setSelectedSectionId("ALL")}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selectedSectionId === "ALL"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40"
                }`}
              >
                All sections
              </button>
              {sectionEntries.map(([sectionId, sectionName]) => (
                <button
                  key={sectionId}
                  type="button"
                  onClick={() => setSelectedSectionId(sectionId)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                    selectedSectionId === sectionId
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/40"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: colorBySection.get(sectionId) ?? "var(--primary)" }}
                  />
                  {sectionName}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Leaf granularity
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { value: 1, label: "Whole" },
                { value: 0.5, label: "Half" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setUnit(option.value as StemLeafUnit)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    unit === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/40"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Whole rounds to the nearest mark. Half keeps 0.5 steps visible.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Sort within leaves
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { value: "score", label: "Score" },
                { value: "section", label: "Section" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSortMode(option.value as StemLeafSortMode)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    sortMode === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/40"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Highlight range
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {HIGHLIGHT_OPTIONS.map((range) => (
                <button
                  key={range.key}
                  type="button"
                  onClick={() => setHighlightRange(range.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    highlightRange === range.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/40"
                  }`}
                >
                  {range.label}
                </button>
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
              {
                label: "Section comparison mode",
                checked: sectionComparisonMode,
                onChange: () => setSectionComparisonMode((current) => !current),
              },
            ].map((control) => (
              <label
                key={control.label}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <span>{control.label}</span>
                <input
                  type="checkbox"
                  checked={control.checked}
                  onChange={control.onChange}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </label>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            Key: <span className="font-mono font-semibold text-foreground">7 | 4</span> means 74 out of{" "}
            {formatNumber(outOf)}.
          </div>
        </aside>

        <main className="min-h-[calc(100vh-12rem)] rounded-2xl border border-border bg-card">
          <div className="sticky top-0 z-10 grid grid-cols-[88px_minmax(0,1fr)] border-b border-border bg-muted/55 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <div>Stem</div>
            <div>Leaves</div>
          </div>
          <div className="divide-y divide-border">
            {stemGroups.length > 0 ? (
              stemGroups.map((group) => (
                <div key={group.id} className="divide-y divide-border">
                  {sectionComparisonMode ? (
                    <div className="bg-muted/35 px-5 py-3 text-sm font-semibold text-foreground">{group.name}</div>
                  ) : null}
                  {group.rows.map((row) => (
                    <div key={`${group.id}-${row.stem}`} className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 px-5 py-4">
                      <div className="font-mono text-2xl font-semibold text-foreground">{row.stem}</div>
                      <div className="flex flex-wrap gap-2.5">
                        {row.leaves.length > 0 ? (
                          row.leaves.map((point) => {
                            const color = getHighlightColor(point.displayScore, point.outOf)
                            const pointRange = getHighlightKey(point.displayScore, point.outOf)
                            const isDimmed = highlightRange !== "ALL" && pointRange !== highlightRange

                            return (
                              <span
                                key={`${point.studentId}-${point.displayScore}-${point.rollNo}`}
                                title={`${point.rollNo} · ${point.studentName} · ${point.sectionName} · ${formatNumber(point.displayScore)} / ${formatNumber(point.outOf)}`}
                                className={`inline-flex min-w-10 items-center justify-center gap-1 rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold shadow-sm transition ${
                                  isDimmed ? "opacity-25 grayscale" : ""
                                }`}
                                style={{
                                  borderColor: color,
                                  color,
                                  background: `linear-gradient(135deg, color-mix(in srgb, ${color} 18%, var(--card)), color-mix(in srgb, ${color} 7%, var(--card)))`,
                                }}
                              >
                                <span>{point.leaf}</span>
                                {showRollNumbers ? (
                                  <span className="text-[10px] font-medium opacity-70">{point.rollNo}</span>
                                ) : null}
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
              ))
            ) : (
              <div className="px-4 py-20 text-center text-sm text-muted-foreground">
                No final marks found for this filter.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
