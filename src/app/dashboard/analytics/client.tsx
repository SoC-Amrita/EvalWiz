"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CHART_THEME, METRIC_COLOR_MAP } from "@/lib/chart-theme"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from "recharts"

type ComponentStat = {
  id: string
  name: string
  code: string
  category: string
  maxMarks: number
  weightage: number
  avg: number
  max: number
  min: number
  countEntered: number
  countMissing: number
  missingSections: Array<{
    label: string
    missingCount: number
  }>
}

type TooltipEntry = {
  color?: string
  name?: string
  value?: string | number
}

type ChartTooltipProps = {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="rounded-lg border p-3 text-xs shadow-xl backdrop-blur-sm"
        style={{
          backgroundColor: CHART_THEME.tooltipBackground,
          borderColor: CHART_THEME.tooltipBorder,
          color: CHART_THEME.tooltipForeground,
        }}
      >
        <p className="font-bold text-sm mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={`${entry.name ?? "metric"}-${index}`} className="flex items-center space-x-2 my-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span style={{ color: CHART_THEME.tooltipMuted }}>{entry.name}:</span>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function AnalyticsClient({ data }: { data: ComponentStat[] }) {
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())

  const toggleComponent = (id: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const activeData = data.filter(d => !excludedIds.has(d.id))

  // Normalize avg to percentage for comparison graph
  const normalizedData = activeData.map(d => ({
    ...d,
    avgPercent: d.maxMarks > 0 ? Number(((d.avg / d.maxMarks) * 100).toFixed(1)) : 0
  }))

  // Calculate Specific Aggregates based on Weightage
  const getSubTotal = (codes: string[]) => {
    return activeData.filter(d => codes.includes(d.code)).reduce((acc, d) => {
      if (d.maxMarks === 0) return acc
      return acc + ((d.avg / d.maxMarks) * d.weightage)
    }, 0)
  }

  const caTotal = getSubTotal(["QZ1", "QZ2", "SP0", "SP1", "SP2"])
  const midTermTotal = getSubTotal(["MID"])
  const endSemTotal = getSubTotal(["END"])
  
  const caPlusMid = caTotal + midTermTotal
  const finalTotal = caPlusMid + endSemTotal

  return (
    <TooltipProvider>
      <div className="space-y-6">
      {/* Component Toggles */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Include in Analytics Calculation</h3>
        <div className="flex flex-wrap gap-2">
          {data.map(stat => {
            const isExcluded = excludedIds.has(stat.id)
            return (
              <Badge 
                key={stat.id}
                variant={isExcluded ? "outline" : "default"}
                className={`cursor-pointer select-none transition-colors ${!isExcluded ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
                onClick={() => toggleComponent(stat.id)}
              >
                {stat.name} {isExcluded && <span className="ml-1 opacity-50">(Excluded)</span>}
              </Badge>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-primary/15 bg-card shadow-md ring-1 ring-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">CA Total (50)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter" style={{ color: METRIC_COLOR_MAP.ca }}>
              {caTotal.toFixed(2)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Sum of Quizzes & Sprints</p>
          </CardContent>
        </Card>
        <Card className="border-primary/15 bg-card shadow-md ring-1 ring-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">CA + Midterms (70)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter" style={{ color: METRIC_COLOR_MAP.caMidTerm }}>
              {(caPlusMid).toFixed(2)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Pre-End Semester Total</p>
          </CardContent>
        </Card>
        <Card className="border-primary/15 bg-card shadow-md ring-1 ring-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">End Sem (30)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter" style={{ color: METRIC_COLOR_MAP.endSemester }}>
              {endSemTotal.toFixed(2)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Final component average</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-primary via-[color:var(--chart-2)] to-[color:var(--chart-8)] text-primary-foreground shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/75">Overall Total (100)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter text-primary-foreground">
              {finalTotal.toFixed(2)} <span className="text-lg font-normal opacity-70">%</span>
            </div>
            <p className="mt-1 text-xs text-primary-foreground/70">Absolute Class Average</p>
          </CardContent>
        </Card>
      </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeData.map((stat) => (
            <Tooltip key={stat.id}>
              <TooltipTrigger className="block text-left">
                <Card className="border-border bg-card shadow-sm transition-all hover:shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-bold">{stat.name}</CardTitle>
                      <div className="flex space-x-2 items-center">
                        <Badge variant="outline" className="h-4 border-primary/20 bg-primary/10 px-1.5 py-0 font-mono text-[10px] text-primary">
                          {stat.code}
                        </Badge>
                        <span className="text-xs font-medium text-muted-foreground">Max {stat.maxMarks}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <div className="text-3xl font-bold tracking-tighter text-foreground">
                          {stat.avg}
                        </div>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Class Average</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-xs font-mono" style={{ color: METRIC_COLOR_MAP.endSemester }}>Max: {stat.max}</p>
                        <p className="text-xs font-mono text-destructive">Min: {stat.min}</p>
                      </div>
                    </div>
                    <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-accent">
                      <div 
                        className="h-full rounded-full bg-primary transition-all duration-1000 ease-out" 
                        style={{ width: `${stat.maxMarks > 0 ? (stat.avg / stat.maxMarks) * 100 : 0}%` }} 
                      />
                    </div>
                    <div className="mt-4 flex justify-between border-t border-border pt-4 text-xs">
                      <span className="text-muted-foreground">{stat.countEntered} Entries</span>
                      {stat.countMissing > 0 ? (
                        <span className="flex items-center font-medium text-[color:var(--chart-6)]">
                          <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--chart-6)]" />
                          {stat.countMissing} Missing
                        </span>
                      ) : (
                        <span style={{ color: METRIC_COLOR_MAP.endSemester }}>100% Complete</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="start"
                className="max-w-sm rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-50 shadow-2xl"
              >
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Missing Marks Snapshot
                  </p>
                  {stat.countMissing > 0 ? (
                    <>
                      <p className="text-sm font-medium text-white">
                        {stat.countMissing} student records are still missing for {stat.name}.
                      </p>
                      <div className="space-y-1 text-xs text-slate-200">
                        {stat.missingSections.map((section) => (
                          <div key={section.label} className="flex items-center justify-between gap-4">
                            <span>{section.label}</span>
                            <span className="font-semibold text-amber-300">{section.missingCount}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm font-medium text-emerald-300">
                      Every visible section is complete for this component.
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-2 bg-card shadow-sm border-border md:col-span-1">
          <CardHeader>
            <CardTitle>Normalized Performance Comparison</CardTitle>
            <CardDescription>Average score percentage (%) across all assessment components</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={normalizedData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_THEME.grid} opacity={0.2} />
                <XAxis 
                  dataKey="code" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: CHART_THEME.axis }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: CHART_THEME.axis }}
                  dx={-10}
                  domain={[0, 100]}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: CHART_THEME.cursor }} />
                <Bar 
                  dataKey="avgPercent" 
                  name="Avg %" 
                  fill={METRIC_COLOR_MAP.ca} 
                  radius={[4, 4, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-border bg-card shadow-sm md:col-span-1">
          <CardHeader>
            <CardTitle>Highest vs Lowest Marks Spread</CardTitle>
            <CardDescription>Visualizing the range gap between max and min scorers.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activeData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_THEME.grid} opacity={0.2} />
                <XAxis 
                  dataKey="code" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: CHART_THEME.axis }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: CHART_THEME.axis }}
                  dx={-10}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line 
                  type="monotone" 
                  dataKey="max" 
                  name="Max Mark" 
                  stroke={METRIC_COLOR_MAP.endSemester} 
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="avg" 
                  name="Avg Mark" 
                  stroke={METRIC_COLOR_MAP.ca} 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 4, strokeWidth: 2 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="min" 
                  name="Min Mark" 
                  stroke="var(--destructive)" 
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      </div>
    </TooltipProvider>
  )
}
