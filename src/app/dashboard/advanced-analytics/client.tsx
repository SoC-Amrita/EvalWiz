"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Download, Filter, RotateCcw } from "lucide-react"

import { AdvancedAnalyticsExportMeta, AssessmentMeta, RawMark, SectionMeta } from "./types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  buildAnalyticsComponentFilters,
  buildWeightedStudentTotals,
  classifyAssessment,
  getAssessmentWeightConfig,
  REPORT_METRICS,
  type ReportMetricKey,
  type WeightedMarkLike,
} from "@/lib/assessment-structure"
import {
  CHART_THEME,
  GRADE_BUCKET_COLORS,
  getCorrelationColor,
  getHeatColor,
  getSectionColor,
} from "@/lib/chart-theme"
import { captureElementAsImage } from "@/lib/pdf-export"

const PANEL_ID = "advanced-analytics-panel"
const EXPORT_CHART_ID = "advanced-analytics-export-chart"

const GRADE_BUCKETS = [
  "S (>=90)",
  "A (80-89)",
  "B (70-79)",
  "C (60-69)",
  "D (50-59)",
  "F (<50)",
]

type TabKey =
  | "histogram"
  | "boxwhisker"
  | "groupedbar"
  | "radar"
  | "violin"
  | "gradeheat"
  | "corrheat"
  | "seccompheat"

const TAB_META: Record<
  TabKey,
  { label: string; title: string; description: string }
> = {
  histogram: {
    label: "Histogram",
    title: "Score Distribution Histogram",
    description:
      "Shows how marks are spread within one assessment using adaptive bins on the raw mark scale.",
  },
  boxwhisker: {
    label: "Box & Whisker",
    title: "Section Comparison With Quartiles",
    description:
      "Compares sections side by side using min, Q1, median, Q3, max, and mean for the selected component.",
  },
  groupedbar: {
    label: "Grouped Bar",
    title: "Section vs Component Comparison",
    description:
      "Compares sections across all visible components using normalized percentage scores, so components with different max marks stay comparable.",
  },
  radar: {
    label: "Radar",
    title: "Multi-Dimensional Section Profile",
    description:
      "Highlights each section's strengths and weak points across visible assessment components as percentages.",
  },
  violin: {
    label: "Violin",
    title: "Density Distribution by Section",
    description:
      "Uses a smooth kernel density estimate to show where student scores cluster for the selected component.",
  },
  gradeheat: {
    label: "Grade Heatmap",
    title: "Grade Distribution Heatmap",
    description:
      "Rows are sections and columns are grade buckets. Scores are normalized to the visible components only.",
  },
  corrheat: {
    label: "Correlation",
    title: "Assessment Correlation Heatmap",
    description:
      "Pearson correlation on normalized percentages, based only on students who have both components entered.",
  },
  seccompheat: {
    label: "Section x Component",
    title: "Section vs Component Performance Heatmap",
    description:
      "Rows are sections and columns are components. Each cell shows average percentage of max marks.",
  },
}

function getTintedHeatmapBackground(color: string, strength: number) {
  const clamped = Math.max(0.18, Math.min(0.82, strength))
  return `color-mix(in srgb, ${color} ${Math.round(clamped * 100)}%, var(--card))`
}

function getHeatmapForeground(strength: number) {
  return strength >= 0.58 ? "var(--primary-foreground)" : "var(--foreground)"
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

  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const mean = sorted.reduce((sum, value) => sum + value, 0) / n
  const variance =
    n > 1
      ? sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)
      : 0

  return {
    mean: Number(mean.toFixed(2)),
    median: Number(quantile(sorted, 0.5).toFixed(2)),
    q1: Number(quantile(sorted, 0.25).toFixed(2)),
    q3: Number(quantile(sorted, 0.75).toFixed(2)),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    stdDev: Number(Math.sqrt(variance).toFixed(2)),
  }
}

function histogram(values: number[], bins: number, min: number, max: number) {
  const safeMax = max <= min ? min + 1 : max
  const binSize = (safeMax - min) / bins
  const counts = Array.from({ length: bins }, (_, index) => {
    const start = min + index * binSize
    const end = min + (index + 1) * binSize
    return {
      label: `${start.toFixed(0)}-${end.toFixed(0)}`,
      count: 0,
    }
  })

  values.forEach((value) => {
    const clamped = Math.max(min, Math.min(value, safeMax))
    const index = Math.min(
      Math.floor((clamped - min) / binSize),
      counts.length - 1
    )
    counts[index].count += 1
  })

  return counts
}

function gradeLabel(score: number) {
  if (score >= 90) return "S (>=90)"
  if (score >= 80) return "A (80-89)"
  if (score >= 70) return "B (70-79)"
  if (score >= 60) return "C (60-69)"
  if (score >= 50) return "D (50-59)"
  return "F (<50)"
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

type ChartTooltipEntry = {
  name?: string | number
  value?: string | number | readonly (string | number)[]
  color?: string
}

type ChartTooltipProps = {
  active?: boolean
  label?: string | number
  payload?: readonly ChartTooltipEntry[]
}

function normalizeMark(mark: RawMark) {
  if (mark.assessmentMax <= 0) return 0
  return (mark.marks / mark.assessmentMax) * 100
}

function gaussianKernel(u: number) {
  return Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI)
}

function kernelDensityEstimate(values: number[], maxValue: number, points = 36) {
  if (!values.length) return []
  const summary = stats(values)
  const bandwidth =
    summary.stdDev > 0
      ? 1.06 * summary.stdDev * Math.pow(values.length, -1 / 5)
      : Math.max(maxValue / 12, 1)
  const safeBandwidth = Math.max(bandwidth, maxValue / 50, 0.5)

  return Array.from({ length: points }, (_, index) => {
    const score = (index / (points - 1)) * maxValue
    const density =
      values.reduce(
        (sum, value) => sum + gaussianKernel((score - value) / safeBandwidth),
        0
      ) /
      (values.length * safeBandwidth)

    return { score, density }
  })
}

function buildViolinPath(
  densityPoints: { score: number; density: number }[],
  centerX: number,
  maxWidth: number,
  maxValue: number,
  top = 20,
  height = 260
) {
  if (!densityPoints.length) return ""
  const maxDensity = Math.max(...densityPoints.map((point) => point.density), 0.0001)
  const left = densityPoints.map((point) => {
    const y = top + (1 - point.score / maxValue) * height
    const width = (point.density / maxDensity) * maxWidth
    return `${centerX - width},${y}`
  })
  const right = [...densityPoints]
    .reverse()
    .map((point) => {
      const y = top + (1 - point.score / maxValue) * height
      const width = (point.density / maxDensity) * maxWidth
      return `${centerX + width},${y}`
    })

  return `M ${left[0]} L ${left.slice(1).join(" L ")} L ${right.join(" L ")} Z`
}

function pearson(xs: number[], ys: number[]) {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return 0

  const xValues = xs.slice(0, n)
  const yValues = ys.slice(0, n)
  const xMean = average(xValues)
  const yMean = average(yValues)

  let numerator = 0
  let xVariance = 0
  let yVariance = 0

  for (let index = 0; index < n; index += 1) {
    const x = xValues[index] - xMean
    const y = yValues[index] - yMean
    numerator += x * y
    xVariance += x * x
    yVariance += y * y
  }

  const denominator = Math.sqrt(xVariance) * Math.sqrt(yVariance)
  if (denominator === 0) return 0
  return Number((numerator / denominator).toFixed(2))
}

function chartTooltip({
  active,
  label,
  payload,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="min-w-36 rounded-lg border px-3 py-2 text-xs shadow-xl"
      style={{
        borderColor: CHART_THEME.tooltipBorder,
        backgroundColor: CHART_THEME.tooltipBackground,
        color: CHART_THEME.tooltipForeground,
      }}
    >
      {label ? <p className="mb-2 text-sm font-semibold">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((entry, index: number) => (
          <div key={`${entry.name}-${index}`} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: (entry.color as string | undefined) ?? CHART_THEME.axis }}
            />
            <span style={{ color: CHART_THEME.tooltipMuted }}>{entry.name}:</span>
            <span className="font-semibold">
              {entry.value ?? "-"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/60 text-center">
      <p className="text-sm font-medium text-foreground">
        No chart data to display
      </p>
      <p className="max-w-md text-xs text-muted-foreground">{message}</p>
    </div>
  )
}

function SectionFilterBar({
  sections,
  selectedSectionIds,
  onToggle,
  onSelectAll,
  onReset,
}: {
  sections: SectionMeta[]
  selectedSectionIds: Set<string>
  onToggle: (sectionId: string) => void
  onSelectAll: () => void
  onReset: () => void
}) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4 text-primary" />
          Visible Sections
        </CardTitle>
        <CardDescription>
          Use this filter across every comparison chart on the page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            Select all
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset defaults
          </Button>
          <Badge variant="outline" className="chip-soft-primary">
            {selectedSectionIds.size} of {sections.length} sections visible
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {sections.map((section, index) => {
            const isSelected = selectedSectionIds.has(section.id)
            const sectionColor = getSectionColor(index)
            return (
              <button
                key={section.id}
                onClick={() => onToggle(section.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  isSelected
                    ? ""
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                style={
                  isSelected
                    ? {
                        backgroundColor: getTintedHeatmapBackground(sectionColor, 0.22),
                        borderColor: `color-mix(in srgb, ${sectionColor} 46%, transparent)`,
                        color: sectionColor,
                      }
                    : undefined
                }
              >
                {section.name}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function AssessmentFilterBar({
  filters,
  selectedFilterKey,
  onCategoryChange,
  assessments,
  selectedAssessmentId,
  onAssessmentChange,
}: {
  filters: Array<{ key: string; label: string }>
  selectedFilterKey: string
  onCategoryChange: (category: string) => void
  assessments: AssessmentMeta[]
  selectedAssessmentId: string
  onAssessmentChange: (assessmentId: string) => void
}) {
  if (!assessments.length) {
    return null
  }

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-sm">Assessment Scope</CardTitle>
        <CardDescription>
          Narrow the visible components, then pick a single assessment where the chart needs one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => onCategoryChange(filter.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                selectedFilterKey === filter.key
                  ? "bg-primary text-primary-foreground"
                  : "chip-soft-primary hover:bg-primary/15"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {assessments.map((assessment) => (
            <button
              key={assessment.id}
              onClick={() => onAssessmentChange(assessment.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                assessment.id === selectedAssessmentId
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {assessment.code}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryStrip({
  visibleMarks,
  visibleSections,
  visibleAssessments,
  metricMeans,
  metricOutOf,
}: {
  visibleMarks: number
  visibleSections: number
  visibleAssessments: number
  metricMeans: Record<ReportMetricKey, number>
  metricOutOf: Record<ReportMetricKey, number>
}) {
  const scopeStats = [
    {
      label: "Visible mark records",
      value: visibleMarks.toLocaleString(),
      tone: "text-primary",
    },
    {
      label: "Visible sections",
      value: String(visibleSections),
      tone: "text-[color:var(--chart-7)]",
    },
    {
      label: "Visible components",
      value: String(visibleAssessments),
      tone: "text-[color:var(--chart-6)]",
    },
  ]

  const componentStats = REPORT_METRICS.map((metric) => ({
    label: metric.label,
    value: metricMeans[metric.key] ?? 0,
    outOf: metricOutOf[metric.key] ?? 0,
    color: metric.color,
  }))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {scopeStats.map((item) => (
          <Card key={item.label} className="border-border bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{item.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold tracking-tight ${item.tone}`}>
                {item.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {componentStats.map((item) => (
          <Card key={item.label} className="border-border bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{item.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight" style={{ color: item.color }}>
                {item.value.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">mean out of {item.outOf}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function HistogramTab({
  rawMarks,
  selectedAssessment,
  exportMode = false,
}: {
  rawMarks: RawMark[]
  selectedAssessment?: AssessmentMeta
  exportMode?: boolean
}) {
  if (!selectedAssessment) {
    return <EmptyState message="No assessment matches the active filter." />
  }

  const values = rawMarks
    .filter((mark) => mark.assessmentId === selectedAssessment.id)
    .map((mark) => mark.marks)

  if (!values.length) {
    return (
      <EmptyState
        message={`No marks are available for ${selectedAssessment.code} in the current section filter.`}
      />
    )
  }

  const distribution = stats(values)
  const bins = histogram(
    values,
    Math.max(6, Math.min(12, Math.round(Math.sqrt(values.length)))),
    0,
    selectedAssessment.maxMarks
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Mean", value: distribution.mean.toFixed(2) },
          { label: "Median", value: distribution.median.toFixed(2) },
          { label: "Std. Dev.", value: distribution.stdDev.toFixed(2) },
          { label: "Sample Size", value: String(values.length) },
        ].map((item) => (
          <Card key={item.label} size="sm" className="border-border bg-muted/60">
            <CardHeader className="pb-1">
              <CardDescription>{item.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-foreground">
                {item.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className={exportMode ? "h-[320px]" : "h-[360px]"}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_THEME.axis, fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              axisLine={false}
              tickLine={false}
              height={50}
            />
            <YAxis
              tick={{ fill: CHART_THEME.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={chartTooltip} cursor={{ fill: CHART_THEME.cursor }} />
            <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
              {bins.map((_, index) => (
                <Cell
                  key={index}
                  fill={getSectionColor(index)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {selectedAssessment.name} ({selectedAssessment.code}) on a 0-
        {selectedAssessment.maxMarks} scale
      </p>
    </div>
  )
}

function BoxWhiskerTab({
  rawMarks,
  selectedAssessment,
  sections,
  exportMode = false,
}: {
  rawMarks: RawMark[]
  selectedAssessment?: AssessmentMeta
  sections: SectionMeta[]
  exportMode?: boolean
}) {
  if (!selectedAssessment) {
    return <EmptyState message="No assessment matches the active filter." />
  }

  const boxData = sections
    .map((section, index) => {
      const values = rawMarks
        .filter(
          (mark) =>
            mark.sectionId === section.id &&
            mark.assessmentId === selectedAssessment.id
        )
        .map((mark) => mark.marks)

      return {
        section,
        values,
        summary: stats(values),
        color: getSectionColor(index),
      }
    })
    .filter((entry) => entry.values.length > 0)

  if (!boxData.length) {
    return (
      <EmptyState
        message={`No section-level distribution is available for ${selectedAssessment.code}.`}
      />
    )
  }

  const horizontalGap = exportMode ? 104 : 120
  const width = Math.max(exportMode ? 980 : 860, 160 + (boxData.length - 1) * horizontalGap + 120)
  const maxValue = selectedAssessment.maxMarks
  const tickValues = Array.from({ length: 6 }, (_, index) =>
    Number(((index / 5) * maxValue).toFixed(0))
  )
  const chartLeft = 88
  const chartRight = width - 72
  const step =
    boxData.length > 1 ? (chartRight - chartLeft) / (boxData.length - 1) : 0

  return (
    <div className={`space-y-4 ${exportMode ? "" : "overflow-x-auto"}`}>
      <svg width={width} height={360} className="mx-auto">
        <line x1={chartLeft} y1={20} x2={chartLeft} y2={300} stroke={CHART_THEME.grid} strokeWidth={1} />
        <line
          x1={chartLeft}
          y1={300}
          x2={chartRight + 12}
          y2={300}
          stroke={CHART_THEME.grid}
          strokeWidth={1}
        />
        {tickValues.map((value) => {
          const y = 20 + (1 - value / maxValue) * 280
          return (
            <g key={value}>
              <line
                x1={chartLeft - 4}
                y1={y}
                x2={chartRight + 12}
                y2={y}
                stroke={CHART_THEME.grid}
                strokeDasharray="4 4"
              />
              <text x={58} y={y + 4} textAnchor="end" fontSize={10} fill={CHART_THEME.axis}>
                {value}
              </text>
            </g>
          )
        })}
        {boxData.map((entry, index) => {
          const centerX =
            boxData.length === 1 ? (chartLeft + chartRight) / 2 : chartLeft + index * step
          const boxWidth = 50
          const toY = (value: number) => 20 + (1 - value / maxValue) * 280

          return (
            <g key={entry.section.id}>
              <line
                x1={centerX}
                y1={toY(entry.summary.max)}
                x2={centerX}
                y2={toY(entry.summary.q3)}
                stroke={entry.color}
                strokeWidth={2}
              />
              <line
                x1={centerX}
                y1={toY(entry.summary.min)}
                x2={centerX}
                y2={toY(entry.summary.q1)}
                stroke={entry.color}
                strokeWidth={2}
              />
              <line
                x1={centerX - 10}
                y1={toY(entry.summary.max)}
                x2={centerX + 10}
                y2={toY(entry.summary.max)}
                stroke={entry.color}
                strokeWidth={2}
              />
              <line
                x1={centerX - 10}
                y1={toY(entry.summary.min)}
                x2={centerX + 10}
                y2={toY(entry.summary.min)}
                stroke={entry.color}
                strokeWidth={2}
              />
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
              <line
                x1={centerX - boxWidth / 2}
                y1={toY(entry.summary.median)}
                x2={centerX + boxWidth / 2}
                y2={toY(entry.summary.median)}
                stroke={entry.color}
                strokeWidth={3}
              />
              <circle cx={centerX} cy={toY(entry.summary.mean)} r={4} fill={entry.color} />
              <text
                x={centerX}
                y={320}
                textAnchor="middle"
                fontSize={11}
                fill={CHART_THEME.axis}
              >
                {entry.section.name}
              </text>
              <text
                x={centerX}
                y={334}
                textAnchor="middle"
                fontSize={9}
                fill={CHART_THEME.axis}
              >
                n={entry.values.length}
              </text>
              <title>{`${entry.section.name}
Min ${entry.summary.min}
Q1 ${entry.summary.q1}
Median ${entry.summary.median}
Q3 ${entry.summary.q3}
Max ${entry.summary.max}
Mean ${entry.summary.mean}
Std Dev ${entry.summary.stdDev}`}</title>
            </g>
          )
        })}
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Box = interquartile range, horizontal line = median, dot = mean
      </p>
    </div>
  )
}

function GroupedBarTab({
  rawMarks,
  assessments,
  sections,
  exportMode = false,
}: {
  rawMarks: RawMark[]
  assessments: AssessmentMeta[]
  sections: SectionMeta[]
  exportMode?: boolean
}) {
  if (!rawMarks.length || !assessments.length || !sections.length) {
    return (
      <EmptyState message="Choose at least one section and one component to compare." />
    )
  }

  const chartData = assessments.map((assessment) => {
    const row: Record<string, string | number | null> = {
      component: assessment.code,
      fullName: assessment.name,
    }

    sections.forEach((section) => {
      const values = rawMarks
        .filter(
          (mark) =>
            mark.sectionId === section.id &&
            mark.assessmentId === assessment.id
        )
        .map((mark) => normalizeMark(mark))

      row[section.name] =
        values.length > 0 ? Number(average(values).toFixed(1)) : null
    })

    return row
  })

  return (
    <div className="space-y-3">
      <div className={exportMode ? "h-[320px]" : "h-[380px]"}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
            <XAxis
              dataKey="component"
              tick={{ fill: CHART_THEME.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: CHART_THEME.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
            />
            <Tooltip content={chartTooltip} cursor={{ fill: CHART_THEME.cursor }} />
            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} />
            {sections.map((section, index) => (
              <Bar
                key={section.id}
                dataKey={section.name}
                name={section.name}
                fill={getSectionColor(index)}
                radius={[3, 3, 0, 0]}
                maxBarSize={28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Y-axis shows average percentage of max marks, not raw scores.
      </p>
    </div>
  )
}

function RadarTab({
  rawMarks,
  assessments,
  sections,
  exportMode = false,
}: {
  rawMarks: RawMark[]
  assessments: AssessmentMeta[]
  sections: SectionMeta[]
  exportMode?: boolean
}) {
  if (!rawMarks.length || !assessments.length || !sections.length) {
    return (
      <EmptyState message="Choose at least one section and one component to compare." />
    )
  }

  const chartData = assessments.map((assessment) => {
    const row: Record<string, string | number> = {
      component: assessment.code,
    }

    sections.forEach((section) => {
      const values = rawMarks
        .filter(
          (mark) =>
            mark.sectionId === section.id &&
            mark.assessmentId === assessment.id
        )
        .map((mark) => normalizeMark(mark))

      row[section.name] = Number(average(values).toFixed(1))
    })

    return row
  })

  return (
    <div className="space-y-3">
      <div className={exportMode ? "h-[340px]" : "h-[420px]"}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
            <PolarGrid stroke={CHART_THEME.grid} />
            <PolarAngleAxis dataKey="component" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: CHART_THEME.axis, fontSize: 10 }} />
            <Tooltip content={chartTooltip} />
            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
            {sections.map((section, index) => (
              <Radar
                key={section.id}
                dataKey={section.name}
                name={section.name}
                stroke={getSectionColor(index)}
                fill={getSectionColor(index)}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Each axis is normalized to percentage of max marks for that component.
      </p>
    </div>
  )
}

function ViolinTab({
  rawMarks,
  selectedAssessment,
  sections,
  exportMode = false,
}: {
  rawMarks: RawMark[]
  selectedAssessment?: AssessmentMeta
  sections: SectionMeta[]
  exportMode?: boolean
}) {
  if (!selectedAssessment) {
    return <EmptyState message="No assessment matches the active filter." />
  }

  const data = sections
    .map((section, index) => {
      const values = rawMarks
        .filter(
          (mark) =>
            mark.sectionId === section.id &&
            mark.assessmentId === selectedAssessment.id
        )
        .map((mark) => mark.marks)

      return {
        section,
        values,
        summary: stats(values),
        density: kernelDensityEstimate(values, selectedAssessment.maxMarks),
        color: getSectionColor(index),
      }
    })
    .filter((entry) => entry.values.length > 0)

  if (!data.length) {
    return (
      <EmptyState
        message={`No marks are available for ${selectedAssessment.code} in the current filter.`}
      />
    )
  }

  const horizontalGap = exportMode ? 104 : 120
  const width = Math.max(exportMode ? 980 : 860, 150 + (data.length - 1) * horizontalGap + 130)
  const height = 340
  const plotHeight = 250
  const maxValue = selectedAssessment.maxMarks
  const tickValues = Array.from({ length: 6 }, (_, index) =>
    Number(((index / 5) * maxValue).toFixed(0))
  )

  const chartLeft = 78
  const chartRight = width - 74
  const step =
    data.length > 1 ? (chartRight - chartLeft) / (data.length - 1) : 0

  return (
    <div className={`space-y-4 ${exportMode ? "" : "overflow-x-auto"}`}>
      <svg width={width} height={height} className="mx-auto">
        {tickValues.map((value) => {
          const y = 20 + (1 - value / maxValue) * plotHeight
          return (
            <g key={value}>
              <line
                x1={chartLeft - 18}
                x2={chartRight + 18}
                y1={y}
                y2={y}
                stroke={CHART_THEME.grid}
                strokeDasharray="4 4"
              />
              <text x={52} y={y + 4} textAnchor="end" fontSize={10} fill={CHART_THEME.axis}>
                {value}
              </text>
            </g>
          )
        })}
        {data.map((entry, index) => {
          const centerX =
            data.length === 1 ? (chartLeft + chartRight) / 2 : chartLeft + index * step
          const path = buildViolinPath(
            entry.density,
            centerX,
            40,
            maxValue,
            20,
            plotHeight
          )
          const medianY = 20 + (1 - entry.summary.median / maxValue) * plotHeight
          const meanY = 20 + (1 - entry.summary.mean / maxValue) * plotHeight

          return (
            <g key={entry.section.id}>
              <path d={path} fill={entry.color} fillOpacity={0.24} stroke={entry.color} strokeWidth={2} />
              <line
                x1={centerX - 36}
                x2={centerX + 36}
                y1={medianY}
                y2={medianY}
                stroke={entry.color}
                strokeWidth={3}
              />
              <circle cx={centerX} cy={meanY} r={4} fill={entry.color} />
              <text
                x={centerX}
                y={300}
                textAnchor="middle"
                fontSize={11}
                fill={CHART_THEME.axis}
              >
                {entry.section.name}
              </text>
              <text
                x={centerX}
                y={314}
                textAnchor="middle"
                fontSize={9}
                fill={CHART_THEME.axis}
              >
                n={entry.values.length}
              </text>
              <title>{`${entry.section.name}
Mean ${entry.summary.mean}
Median ${entry.summary.median}
Std Dev ${entry.summary.stdDev}`}</title>
            </g>
          )
        })}
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Width reflects score density from a Gaussian kernel density estimate. Line = median, dot = mean.
      </p>
    </div>
  )
}

function GradeHeatmapTab({
  rawMarks,
  assessments,
  sections,
  exportMode = false,
}: {
  rawMarks: RawMark[]
  assessments: AssessmentMeta[]
  sections: SectionMeta[]
  exportMode?: boolean
}) {
  if (!rawMarks.length || !assessments.length || !sections.length) {
    return (
      <EmptyState message="Grade distribution appears once marks exist for the visible filter." />
    )
  }

  const studentScoreMap = new Map<
    string,
    { sectionId: string; achieved: number; possible: number }
  >()

  rawMarks.forEach((mark) => {
    const key = `${mark.sectionId}:${mark.studentId}`
    if (!studentScoreMap.has(key)) {
      studentScoreMap.set(key, {
        sectionId: mark.sectionId,
        achieved: 0,
        possible: 0,
      })
    }

    const entry = studentScoreMap.get(key)!
    entry.achieved += normalizeMark(mark) * mark.assessmentWeightage
    entry.possible += mark.assessmentWeightage
  })

  const rows = sections.map((section) => {
    const percentages = [...studentScoreMap.values()]
      .filter((entry) => entry.sectionId === section.id && entry.possible > 0)
      .map((entry) => (entry.achieved / entry.possible) * 100)

    const buckets = Object.fromEntries(
      GRADE_BUCKETS.map((bucket) => [bucket, 0])
    ) as Record<string, number>

    percentages.forEach((percentage) => {
      buckets[gradeLabel(percentage)] += 1
    })

    return {
      section,
      buckets,
      total: percentages.length,
    }
  })

  const maxProportion = Math.max(
    ...rows.flatMap((row) =>
      GRADE_BUCKETS.map((bucket) =>
        row.total > 0 ? row.buckets[bucket] / row.total : 0
      )
    ),
    0.01
  )

  return (
    <div className={exportMode ? "" : "overflow-x-auto"}>
      <table className={exportMode ? "w-full" : "min-w-[640px]"} style={{ borderCollapse: "separate", borderSpacing: exportMode ? 4 : 6 }}>
        <thead>
          <tr>
            <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
              Section
            </th>
            {GRADE_BUCKETS.map((bucket, index) => (
              <th
                key={bucket}
                className="px-2 py-2 text-center text-xs font-semibold text-foreground"
              >
                <span
                  className="inline-flex rounded-full px-2 py-1"
                  style={{
                    background: getTintedHeatmapBackground(GRADE_BUCKET_COLORS[index], 0.26),
                    border: `1px solid color-mix(in srgb, ${GRADE_BUCKET_COLORS[index]} 42%, transparent)`,
                    color: GRADE_BUCKET_COLORS[index],
                  }}
                >
                  {bucket}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.section.id}>
              <td className="px-2 py-2 text-sm font-semibold text-foreground">
                {row.section.name}
              </td>
              {GRADE_BUCKETS.map((bucket, index) => {
                const proportion = row.total > 0 ? row.buckets[bucket] / row.total : 0
                const strength = 0.18 + (proportion / maxProportion) * 0.64
                return (
                  <td key={bucket} className="p-1">
                  <div
                    className="flex min-h-14 min-w-20 flex-col items-center justify-center rounded-lg"
                    style={{
                      background: getTintedHeatmapBackground(GRADE_BUCKET_COLORS[index], strength),
                      color: getHeatmapForeground(strength),
                    }}
                    title={`${row.section.name} - ${bucket}: ${row.buckets[bucket]} students`}
                    >
                      <span className="text-sm font-bold">
                        {row.buckets[bucket]}
                      </span>
                      <span className="text-[10px] opacity-80">
                        {row.total > 0 ? `${(proportion * 100).toFixed(0)}%` : "0%"}
                      </span>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-muted-foreground">
        Student grade buckets are computed from weighted percentages across the currently visible components only.
      </p>
    </div>
  )
}

function CorrelationHeatmapTab({
  rawMarks,
  assessments,
  exportMode = false,
}: {
  rawMarks: RawMark[]
  assessments: AssessmentMeta[]
  exportMode?: boolean
}) {
  if (!rawMarks.length || assessments.length < 2) {
    return (
      <EmptyState message="Correlation needs at least two visible components with overlapping student data." />
    )
  }

  const marksByStudent = new Map<string, Map<string, number>>()
  rawMarks.forEach((mark) => {
    if (!marksByStudent.has(mark.studentId)) {
      marksByStudent.set(mark.studentId, new Map())
    }
    marksByStudent
      .get(mark.studentId)!
      .set(mark.assessmentId, normalizeMark(mark))
  })

  const strongestPairs: Array<{ label: string; correlation: number; overlap: number }> = []

  const matrix = assessments.map((leftAssessment, rowIndex) =>
    assessments.map((rightAssessment, colIndex) => {
      const leftValues: number[] = []
      const rightValues: number[] = []

      marksByStudent.forEach((studentMarks) => {
        const left = studentMarks.get(leftAssessment.id)
        const right = studentMarks.get(rightAssessment.id)
        if (left !== undefined && right !== undefined) {
          leftValues.push(left)
          rightValues.push(right)
        }
      })

      const correlation =
        rowIndex === colIndex ? 1 : pearson(leftValues, rightValues)

      if (rowIndex < colIndex && leftValues.length >= 2) {
        strongestPairs.push({
          label: `${leftAssessment.code} vs ${rightAssessment.code}`,
          correlation,
          overlap: leftValues.length,
        })
      }

      return {
        correlation,
        overlap: leftValues.length,
      }
    })
  )

  strongestPairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
  const topPairs = strongestPairs.slice(0, 3)
  const cellSize = exportMode
    ? Math.max(42, Math.min(56, Math.floor(660 / Math.max(assessments.length, 1))))
    : 62
  const totalWidth = 76 + assessments.length * (cellSize + 4)

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {topPairs.map((pair) => (
          <Card key={pair.label} size="sm" className="border-border bg-muted/60">
            <CardHeader className="pb-1">
              <CardDescription>{pair.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-foreground">
                r = {pair.correlation.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                overlap: {pair.overlap} students
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="overflow-auto">
        <div style={{ position: "relative", paddingLeft: 76, paddingTop: 60, width: totalWidth }}>
          {assessments.map((assessment, column) => (
            <div
              key={assessment.id}
              style={{
                position: "absolute",
                top: 0,
                left: 76 + column * cellSize + cellSize / 2,
                width: cellSize,
                transform: "translateX(-50%)",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--primary)",
              }}
            >
              {assessment.code}
            </div>
          ))}
          {matrix.map((row, rowIndex) => (
            <div key={assessments[rowIndex].id} className="flex items-center">
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  width: 68,
                  textAlign: "right",
                  paddingRight: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--primary)",
                }}
              >
                {assessments[rowIndex].code}
              </div>
              {row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    margin: 2,
                    borderRadius: 6,
                    background: getCorrelationColor(cell.correlation),
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title={`${assessments[rowIndex].code} x ${assessments[colIndex].code}: r=${cell.correlation.toFixed(
                    2
                  )}, overlap=${cell.overlap}`}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color:
                        Math.abs(cell.correlation) >= 0.5
                          ? "var(--primary-foreground)"
                          : "var(--foreground)",
                    }}
                  >
                    {cell.correlation.toFixed(2)}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color:
                        Math.abs(cell.correlation) >= 0.5
                          ? "color-mix(in srgb, var(--primary-foreground) 76%, transparent)"
                          : "var(--muted-foreground)",
                    }}
                  >
                    n={cell.overlap}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Correlation uses normalized percentages. Stronger values indicate students tend to rank similarly across those two components.
      </p>
    </div>
  )
}

function SectionComponentHeatmapTab({
  rawMarks,
  assessments,
  sections,
  exportMode = false,
}: {
  rawMarks: RawMark[]
  assessments: AssessmentMeta[]
  sections: SectionMeta[]
  exportMode?: boolean
}) {
  if (!rawMarks.length || !assessments.length || !sections.length) {
    return (
      <EmptyState message="Choose at least one section and one component to build the heatmap." />
    )
  }

  const grid = sections.map((section) =>
    assessments.map((assessment) => {
      const values = rawMarks
        .filter(
          (mark) =>
            mark.sectionId === section.id &&
            mark.assessmentId === assessment.id
        )
        .map((mark) => normalizeMark(mark))

      return values.length > 0 ? Number(average(values).toFixed(1)) : null
    })
  )

  const cellWidth = exportMode
    ? Math.max(52, Math.floor(700 / Math.max(assessments.length, 1)))
    : Math.max(74, Math.floor(760 / Math.max(assessments.length, 1)))

  return (
    <div className="space-y-4 overflow-auto">
      <table style={{ borderCollapse: "separate", borderSpacing: 4 }}>
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
              Section
            </th>
            {assessments.map((assessment) => (
              <th
                key={assessment.id}
                className="px-2 py-2 text-center text-xs font-semibold text-primary"
                style={{ minWidth: cellWidth }}
                title={assessment.name}
              >
                {assessment.code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, rowIndex) => (
            <tr key={sections[rowIndex].id}>
              <td className="px-3 py-2 text-sm font-semibold text-foreground">
                {sections[rowIndex].name}
              </td>
              {row.map((value, columnIndex) => {
                const strength = value === null ? 0.2 : 0.26 + Math.min(value / 100, 1) * 0.5
                return (
                  <td key={`${rowIndex}-${columnIndex}`} className="p-0">
                    <div
                      className="flex h-14 items-center justify-center rounded-lg text-sm font-bold"
                      style={{
                        minWidth: cellWidth,
                        background: getTintedHeatmapBackground(getHeatColor(value), strength),
                        color: value === null ? "var(--muted-foreground)" : getHeatmapForeground(strength),
                      }}
                      title={
                        value !== null
                          ? `${sections[rowIndex].name} x ${assessments[columnIndex].code}: ${value}%`
                          : `${sections[rowIndex].name} x ${assessments[columnIndex].code}: no data`
                      }
                    >
                      {value !== null ? `${value}%` : "-"}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">
        Every cell is the average percentage of max marks for that section-component pair.
      </p>
    </div>
  )
}

function needsFocusedAssessment(tab: TabKey) {
  return tab === "histogram" || tab === "boxwhisker" || tab === "violin"
}

export function AdvancedAnalyticsClient({
  rawMarks,
  assessments,
  sections,
  exportMeta,
}: {
  rawMarks: RawMark[]
  assessments: AssessmentMeta[]
  sections: SectionMeta[]
  exportMeta: AdvancedAnalyticsExportMeta
}) {
  const [tab, setTab] = useState<TabKey>("histogram")
  const [selectedCategory, setSelectedCategory] = useState("ALL")
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(
    assessments[0]?.id ?? ""
  )
  const [selectedSectionIds, setSelectedSectionIds] = useState(
    () => new Set(sections.map((section) => section.id))
  )
  const [isExporting, setIsExporting] = useState(false)

  const filterOptions = useMemo(
    () =>
      buildAnalyticsComponentFilters(
        assessments.map((assessment) => ({
          code: assessment.code,
          name: assessment.name,
          category: assessment.category,
          weightage: assessment.weightage,
          maxMarks: assessment.maxMarks,
        }))
      ).map(({ key, label }) => ({ key, label })),
    [assessments]
  )

  const matchesSelectedCategory = useCallback((assessment: AssessmentMeta) => {
    const classification = classifyAssessment(assessment)

    switch (selectedCategory) {
      case "ALL":
        return true
      case "CONTINUOUS_ASSESSMENT":
        return classification.family === "CONTINUOUS_ASSESSMENT"
      case "CA_QUIZ":
      case "CA_REVIEW":
      case "CA_OTHER":
        return classification.analyticsFilterKey === selectedCategory
      case "MID_TERM":
        return classification.family === "MID_TERM"
      case "END_SEMESTER":
        return classification.family === "END_SEMESTER"
      default:
        return true
    }
  }, [selectedCategory])

  const visibleAssessments = useMemo(
    () => assessments.filter(matchesSelectedCategory),
    [assessments, matchesSelectedCategory]
  )

  const visibleAssessmentIds = useMemo(
    () => new Set(visibleAssessments.map((assessment) => assessment.id)),
    [visibleAssessments]
  )

  const visibleSections = useMemo(
    () => sections.filter((section) => selectedSectionIds.has(section.id)),
    [sections, selectedSectionIds]
  )

  const visibleMarks = useMemo(
    () =>
      rawMarks.filter(
        (mark) =>
          selectedSectionIds.has(mark.sectionId) &&
          visibleAssessmentIds.has(mark.assessmentId)
      ),
    [rawMarks, selectedSectionIds, visibleAssessmentIds]
  )

  const selectedAssessment = useMemo(
    () =>
      visibleAssessments.find(
        (assessment) => assessment.id === selectedAssessmentId
      ),
    [visibleAssessments, selectedAssessmentId]
  )
  const visibleWeightConfig = useMemo(
    () =>
      getAssessmentWeightConfig(
        visibleAssessments.map((assessment) => ({
          code: assessment.code,
          name: assessment.name,
          category: assessment.category,
          weightage: assessment.weightage,
          maxMarks: assessment.maxMarks,
        }))
      ),
    [visibleAssessments]
  )

  const visibleMetricMeans = useMemo(() => {
    const marksByStudent = new Map<string, WeightedMarkLike[]>()

    visibleMarks.forEach((mark) => {
      if (!marksByStudent.has(mark.studentId)) {
        marksByStudent.set(mark.studentId, [])
      }

      marksByStudent.get(mark.studentId)!.push({
        marks: mark.marks,
        assessment: {
          code: mark.assessmentCode,
          name: mark.assessmentName,
          category: mark.assessmentCategory,
          weightage: mark.assessmentWeightage,
          maxMarks: mark.assessmentMax,
        },
      })
    })

    const studentTotals = [...marksByStudent.values()].map((studentMarks) =>
      buildWeightedStudentTotals(studentMarks)
    )

    return REPORT_METRICS.reduce(
      (accumulator, metric) => {
        accumulator[metric.key] =
          studentTotals.length > 0
            ? studentTotals.reduce((sum, totals) => sum + totals[metric.key], 0) /
              studentTotals.length
            : 0
        return accumulator
      },
      {} as Record<ReportMetricKey, number>
    )
  }, [visibleMarks])

  useEffect(() => {
    if (!visibleAssessments.length) {
      setSelectedAssessmentId("")
      return
    }

    const stillVisible = visibleAssessments.some(
      (assessment) => assessment.id === selectedAssessmentId
    )
    if (!stillVisible) {
      setSelectedAssessmentId(visibleAssessments[0].id)
    }
  }, [selectedAssessmentId, visibleAssessments])

  const toggleSection = (sectionId: string) => {
    setSelectedSectionIds((current) => {
      const next = new Set(current)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  const resetFilters = () => {
    setSelectedCategory("ALL")
    setSelectedAssessmentId(assessments[0]?.id ?? "")
    setSelectedSectionIds(new Set(sections.map((section) => section.id)))
  }

  const exportActivePanel = async () => {
    setIsExporting(true)
    try {
      const { imgData } = await captureElementAsImage(
        EXPORT_CHART_ID,
        { pixelRatio: 2.5, forceLightTheme: true }
      )
      const link = document.createElement("a")
      link.href = imgData
      link.download = `advanced-analytics-${tab}-${new Date().toISOString().slice(0, 10)}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } finally {
      setIsExporting(false)
    }
  }

  const renderTab = (exportMode = false) => {
    switch (tab) {
      case "histogram":
        return (
          <HistogramTab
            rawMarks={visibleMarks}
            selectedAssessment={selectedAssessment}
            exportMode={exportMode}
          />
        )
      case "boxwhisker":
        return (
          <BoxWhiskerTab
            rawMarks={visibleMarks}
            selectedAssessment={selectedAssessment}
            sections={visibleSections}
            exportMode={exportMode}
          />
        )
      case "groupedbar":
        return (
          <GroupedBarTab
            rawMarks={visibleMarks}
            assessments={visibleAssessments}
            sections={visibleSections}
            exportMode={exportMode}
          />
        )
      case "radar":
        return (
          <RadarTab
            rawMarks={visibleMarks}
            assessments={visibleAssessments}
            sections={visibleSections}
            exportMode={exportMode}
          />
        )
      case "violin":
        return (
          <ViolinTab
            rawMarks={visibleMarks}
            selectedAssessment={selectedAssessment}
            sections={visibleSections}
            exportMode={exportMode}
          />
        )
      case "gradeheat":
        return (
          <GradeHeatmapTab
            rawMarks={visibleMarks}
            assessments={visibleAssessments}
            sections={visibleSections}
            exportMode={exportMode}
          />
        )
      case "corrheat":
        return (
          <CorrelationHeatmapTab
            rawMarks={visibleMarks}
            assessments={visibleAssessments}
            exportMode={exportMode}
          />
        )
      case "seccompheat":
        return (
          <SectionComponentHeatmapTab
            rawMarks={visibleMarks}
            assessments={visibleAssessments}
            sections={visibleSections}
            exportMode={exportMode}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <SummaryStrip
        visibleMarks={visibleMarks.length}
        visibleSections={visibleSections.length}
        visibleAssessments={visibleAssessments.length}
        metricMeans={visibleMetricMeans}
        metricOutOf={visibleWeightConfig}
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionFilterBar
          sections={sections}
          selectedSectionIds={selectedSectionIds}
          onToggle={toggleSection}
          onSelectAll={() =>
            setSelectedSectionIds(new Set(sections.map((section) => section.id)))
          }
          onReset={resetFilters}
        />
        <AssessmentFilterBar
          filters={filterOptions}
          selectedFilterKey={selectedCategory}
          onCategoryChange={setSelectedCategory}
          assessments={visibleAssessments}
          selectedAssessmentId={selectedAssessmentId}
          onAssessmentChange={setSelectedAssessmentId}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {(Object.keys(TAB_META) as TabKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
              tab === key
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {TAB_META[key].label}
          </button>
        ))}
      </div>

      <Card
        id={PANEL_ID}
        className="border-border bg-card shadow-sm"
      >
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle>{TAB_META[tab].title}</CardTitle>
              <CardDescription>{TAB_META[tab].description}</CardDescription>
              {needsFocusedAssessment(tab) && selectedAssessment ? (
                <div className="pt-1">
                  <Badge
                    variant="outline"
                    className="chip-soft-primary"
                  >
                    Focus component: {selectedAssessment.code} - {selectedAssessment.name}
                  </Badge>
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={exportActivePanel}
                disabled={isExporting}
                className="shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                {isExporting ? "Exporting..." : "Export PNG"}
              </Button>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Badge
                  variant="outline"
                  className="chip-soft-neutral"
                >
                  {visibleSections.length} sections
                </Badge>
                <Badge
                  variant="outline"
                  className="chip-soft-neutral"
                >
                  {visibleAssessments.length} components
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-6">{renderTab()}</CardContent>
      </Card>

      <div
        style={{
          position: "fixed",
          top: -20000,
          left: -20000,
          width: 920,
          background: "#ffffff",
          color: "#0f172a",
          padding: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <div style={{ width: 920, boxSizing: "border-box", padding: 20, backgroundColor: "#ffffff" }}>
          <div
            id={EXPORT_CHART_ID}
            style={{
              width: 880,
              border: "1px solid #e2e8f0",
              borderRadius: 18,
              padding: 0,
              backgroundColor: "#ffffff",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                backgroundColor: "#fff7ed",
                borderBottom: "2px solid #4f46e5",
                padding: "18px 22px 16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ color: "#6366f1", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em" }}>
                  EVALWIZ
                </div>
                <div style={{ color: "#9f1239", fontSize: 14, fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>
                  {TAB_META[tab].title}
                </div>
              </div>
              <div style={{ color: "#0f172a", fontSize: 10, fontWeight: 700, textAlign: "center", lineHeight: 1.4 }}>
                <div>{exportMeta.department}</div>
                <div>{exportMeta.school}</div>
                <div>{exportMeta.institution}</div>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
                padding: 18,
                backgroundColor: "#ffffff",
              }}
            >
              {[
                ["Subject Code", exportMeta.subjectCode],
                ["Subject", exportMeta.subjectTitle],
                ["Program", exportMeta.program],
                ["Semester", exportMeta.semester],
                ["Year", exportMeta.year],
                ["Academic Year", exportMeta.academicYear],
                ["Term", exportMeta.term],
                ["Mentors", exportMeta.mentors.join(", ") || "—"],
                ["Course Type", exportMeta.courseType],
                ["Evaluation Pattern", exportMeta.evaluationPattern],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    backgroundColor: "#ffffff",
                    padding: "8px 10px",
                  }}
                >
                  <div style={{ color: "#64748b", fontSize: 8, fontWeight: 700, marginBottom: 5 }}>
                    {label.toUpperCase()}
                  </div>
                  <div style={{ color: "#0f172a", fontSize: 9, lineHeight: 1.35 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "0 20px 20px" }}>{renderTab(true)}</div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {rawMarks.length.toLocaleString()} total mark records loaded across{" "}
        {sections.length} sections and {assessments.length} assessment components
      </p>
    </div>
  )
}
