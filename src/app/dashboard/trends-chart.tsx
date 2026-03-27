"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts"
import { CHART_THEME, METRIC_COLOR_MAP } from "@/lib/chart-theme"

type ChartPoint = {
  name: string
  fullName: string
  avg: number
  max: number
  count: number
}

const CATEGORY_COLORS: Record<string, string> = {
  QZ1: METRIC_COLOR_MAP.quiz, QZ2: METRIC_COLOR_MAP.quiz,
  SP0: METRIC_COLOR_MAP.review, SP1: METRIC_COLOR_MAP.review, SP2: METRIC_COLOR_MAP.review,
  MID: METRIC_COLOR_MAP.midTerm,
  END: METRIC_COLOR_MAP.endSemester,
}

type TrendsTooltipPayload = {
  payload?: ChartPoint
}

type TrendsTooltipProps = {
  active?: boolean
  payload?: TrendsTooltipPayload[]
}

const CustomTooltip = ({ active, payload }: TrendsTooltipProps) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (!d) return null
  return (
    <div style={{
      backgroundColor: CHART_THEME.tooltipBackground,
      border: `1px solid ${CHART_THEME.tooltipBorder}`,
      borderRadius: "8px",
      padding: "10px 14px",
      fontSize: "12px",
      color: CHART_THEME.tooltipForeground,
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      minWidth: "160px"
    }}>
      <p style={{ fontWeight: 700, fontSize: "13px", marginBottom: "6px", color: CHART_THEME.tooltipForeground }}>{d.fullName}</p>
      <p style={{ color: CHART_THEME.tooltipMuted, margin: "2px 0" }}>
        Avg: <span style={{ color: METRIC_COLOR_MAP.ca, fontFamily: "monospace", fontWeight: 700 }}>{d.avg.toFixed(2)}</span>
        <span style={{ color: CHART_THEME.tooltipMuted }}> / {d.max}</span>
      </p>
      <p style={{ color: CHART_THEME.tooltipMuted, marginTop: "4px", fontSize: "11px" }}>{d.count} records entered</p>
    </div>
  )
}


export function DashboardTrendsChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0 || data.every(d => d.count === 0)) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No marks data entered yet.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_THEME.grid} />
        <XAxis
          dataKey="name"
          tick={{ fill: CHART_THEME.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: CHART_THEME.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART_THEME.cursor, opacity: 0.8 }} />
        <Bar dataKey="avg" name="Average" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={CATEGORY_COLORS[entry.name] ?? CHART_THEME.axis}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
