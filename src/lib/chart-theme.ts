export const CHART_SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const

export const GRADE_BUCKET_COLORS = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-6)",
  "var(--chart-4)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const

export const METRIC_COLOR_MAP = {
  quiz: "var(--metric-quiz)",
  review: "var(--metric-review)",
  ca: "var(--metric-ca)",
  midTerm: "var(--metric-mid)",
  caMidTerm: "var(--metric-ca-mid)",
  endSemester: "var(--metric-end)",
  overall: "var(--metric-overall)",
} as const

export const CHART_THEME = {
  axis: "var(--chart-axis)",
  grid: "var(--chart-grid)",
  tooltipBackground: "var(--chart-tooltip-bg)",
  tooltipBorder: "var(--chart-tooltip-border)",
  tooltipForeground: "var(--chart-tooltip-foreground)",
  tooltipMuted: "var(--chart-tooltip-muted)",
  cursor: "var(--chart-cursor)",
  heatEmpty: "var(--heat-empty)",
  heatLow: "var(--heat-low)",
  heatMid: "var(--heat-mid)",
  heatHigh: "var(--heat-high)",
  heatHot: "var(--heat-hot)",
} as const

export function getSectionColor(index: number) {
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length]
}

export function getCorrelationColor(value: number) {
  if (value >= 0.8) return "var(--correlation-strong-pos)"
  if (value >= 0.6) return "var(--correlation-pos)"
  if (value >= 0.4) return "var(--correlation-soft-pos)"
  if (value >= 0.2) return "var(--correlation-faint-pos)"
  if (value >= 0) return "var(--correlation-neutral)"
  if (value >= -0.2) return "var(--correlation-faint-neg)"
  if (value >= -0.4) return "var(--correlation-soft-neg)"
  if (value >= -0.6) return "var(--correlation-neg)"
  return "var(--correlation-strong-neg)"
}

export function getHeatColor(value: number | null) {
  if (value === null) return CHART_THEME.heatEmpty
  if (value >= 80) return CHART_THEME.heatHot
  if (value >= 65) return CHART_THEME.heatHigh
  if (value >= 50) return CHART_THEME.heatMid
  if (value >= 35) return CHART_THEME.heatLow
  return "var(--destructive)"
}
