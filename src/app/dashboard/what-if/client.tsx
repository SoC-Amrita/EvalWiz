"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { CHART_SERIES_COLORS, CHART_THEME } from "@/lib/chart-theme"
import { cn } from "@/lib/utils"
import {
  BarChart3,
  Gauge,
  GraduationCap,
  Layers3,
  RotateCcw,
  Target,
  TrendingUp,
  WandSparkles,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

type SimulationAssessment = {
  id: string
  name: string
  code: string
  maxMarks: number
  weightage: number
  category: string
}

type SimulationStudent = {
  id: string
  rollNo: string
  name: string
  marks: Record<string, number | null>
}

type SimulationSection = {
  id: string
  name: string
  label: string
  studentCount: number
  students: SimulationStudent[]
}

type WhatIfClientProps = {
  sections: SimulationSection[]
  assessments: SimulationAssessment[]
  roleView: "mentor" | "faculty" | "administrator"
  workspaceCode: string
}

type TargetPopulation = "everyone" | "belowTarget" | "topThird"
type RoundingMode = "none" | "half" | "whole"
type ScenarioState = {
  selectionKey: string
  population: TargetPopulation
  bonus: number
  scale: number
  minimumScore: number
  rescueTo: number
  cap: number
  passThreshold: number
  rounding: RoundingMode
}

type TooltipPayloadEntry = { color?: string; name?: string; value?: number }
type TooltipProps = { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }

const DISTRIBUTION_BINS = ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"] as const

const PRESETS = [
  {
    id: "gentle",
    label: "Gentle moderation",
    description: "Small uplift across the selected group.",
    apply: (maxMarks: number) => ({
      bonus: maxMarks * 0.03,
      scale: 1.03,
      minimumScore: 0,
      rescueTo: 0,
      cap: maxMarks,
      population: "everyone" as const,
      rounding: "half" as const,
    }),
  },
  {
    id: "rescue",
    label: "Pass-line rescue",
    description: "Lift only students below the current target line.",
    apply: (maxMarks: number) => ({
      bonus: 0,
      scale: 1,
      minimumScore: 0,
      rescueTo: maxMarks * 0.5,
      cap: maxMarks,
      population: "belowTarget" as const,
      rounding: "whole" as const,
    }),
  },
  {
    id: "stretch",
    label: "Top-end stretch",
    description: "Boost the highest third without changing the rest.",
    apply: (maxMarks: number) => ({
      bonus: 0,
      scale: 1.08,
      minimumScore: 0,
      rescueTo: 0,
      cap: maxMarks,
      population: "topThird" as const,
      rounding: "half" as const,
    }),
  },
]

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-lg border p-3 text-xs shadow-xl backdrop-blur-sm"
      style={{
        backgroundColor: CHART_THEME.tooltipBackground,
        borderColor: CHART_THEME.tooltipBorder,
        color: CHART_THEME.tooltipForeground,
      }}
    >
      <p className="mb-2 text-sm font-semibold">{label}</p>
      {payload.map((entry, index) => (
        <div key={`${entry.name ?? "metric"}-${index}`} className="my-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span style={{ color: CHART_THEME.tooltipMuted }}>{entry.name}:</span>
          <span className="font-medium">{entry.value?.toFixed(1) ?? "0.0"}</span>
        </div>
      ))}
    </div>
  )
}

function roundValue(value: number, rounding: RoundingMode) {
  if (rounding === "half") return Math.round(value * 2) / 2
  if (rounding === "whole") return Math.round(value)
  return value
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getDistributionBin(score: number, maxScore: number) {
  const safeMax = maxScore <= 0 ? 100 : maxScore
  const percentage = (score / safeMax) * 100

  if (percentage < 20) return "0-20%"
  if (percentage < 40) return "20-40%"
  if (percentage < 60) return "40-60%"
  if (percentage < 80) return "60-80%"
  return "80-100%"
}

function getAggregateScore(student: SimulationStudent, assessments: SimulationAssessment[]) {
  if (assessments.length === 0) return 0

  const weightedAssessments = assessments.filter((assessment) => assessment.weightage > 0)

  if (weightedAssessments.length > 0) {
    const totalWeight = weightedAssessments.reduce((sum, assessment) => sum + assessment.weightage, 0)
    if (totalWeight <= 0) return 0

    const total = weightedAssessments.reduce((sum, assessment) => {
      const mark = student.marks[assessment.id] ?? 0
      const percentage = assessment.maxMarks > 0 ? (mark / assessment.maxMarks) * 100 : 0
      return sum + percentage * assessment.weightage
    }, 0)

    return total / totalWeight
  }

  const total = assessments.reduce((sum, assessment) => {
    const mark = student.marks[assessment.id] ?? 0
    return sum + (assessment.maxMarks > 0 ? (mark / assessment.maxMarks) * 100 : 0)
  }, 0)

  return total / assessments.length
}

function createScenarioState(maxScore: number, selectionKey: string): ScenarioState {
  return {
    selectionKey,
    population: "everyone",
    bonus: 0,
    scale: 1,
    minimumScore: 0,
    rescueTo: 0,
    cap: maxScore,
    passThreshold: Number((maxScore * 0.5).toFixed(1)),
    rounding: "none",
  }
}

export function WhatIfClient({
  sections,
  assessments,
  roleView,
  workspaceCode,
}: WhatIfClientProps) {
  const courseScopeAllowed = roleView === "mentor" && sections.length > 1
  const [scopePreference, setScopePreference] = useState<string>(courseScopeAllowed ? "course" : sections[0]?.id ?? "")
  const [assessmentPreference, setAssessmentPreference] = useState<string>(assessments.length > 1 ? "all" : assessments[0]?.id ?? "")

  const activeScope = courseScopeAllowed
    ? scopePreference === "course" || sections.some((section) => section.id === scopePreference)
      ? scopePreference
      : "course"
    : sections.some((section) => section.id === scopePreference)
      ? scopePreference
      : sections[0]?.id ?? ""

  const activeAssessment =
    assessments.length <= 1
      ? assessments[0]?.id ?? ""
      : assessmentPreference === "all" || assessments.some((assessment) => assessment.id === assessmentPreference)
        ? assessmentPreference
        : "all"

  const selectedAssessments =
    activeAssessment === "all"
      ? assessments
      : assessments.filter((assessment) => assessment.id === activeAssessment)

  const selectedAssessment = selectedAssessments[0] ?? null
  const selectedMaxScore = activeAssessment === "all" ? 100 : selectedAssessment?.maxMarks ?? 100
  const distinctionThreshold = selectedMaxScore * 0.75
  const selectionKey = `${activeAssessment}:${selectedMaxScore}`
  const [scenarioState, setScenarioState] = useState<ScenarioState>(() => createScenarioState(selectedMaxScore, selectionKey))
  const scenario = scenarioState.selectionKey === selectionKey ? scenarioState : createScenarioState(selectedMaxScore, selectionKey)

  const scopedSections =
    activeScope === "course" ? sections : sections.filter((section) => section.id === activeScope)

  const scopedStudents = scopedSections.flatMap((section) =>
    section.students.map((student) => ({
      ...student,
      sectionId: section.id,
      sectionLabel: section.label,
    }))
  )

  const scoredRows = scopedStudents.map((student) => ({
    ...student,
    original:
      activeAssessment === "all"
        ? getAggregateScore(student, selectedAssessments)
        : student.marks[selectedAssessment?.id ?? ""] ?? 0,
  }))

  const sortedByOriginal = [...scoredRows].sort((left, right) => right.original - left.original)
  const topThirdCount = Math.max(1, Math.ceil(sortedByOriginal.length / 3))
  const topThirdIds = new Set(sortedByOriginal.slice(0, topThirdCount).map((row) => row.id))

  const shouldAdjustStudent = (studentId: string, original: number) => {
    if (scenario.population === "belowTarget") return original < scenario.passThreshold
    if (scenario.population === "topThird") return topThirdIds.has(studentId)
    return true
  }

  const simulateScore = (original: number, maxScore: number, shouldAdjust: boolean) => {
    if (!shouldAdjust) return clamp(roundValue(original, scenario.rounding), 0, maxScore)

    let next = Math.max(original, scenario.minimumScore)
    next = next * scenario.scale + scenario.bonus

    if (scenario.rescueTo > 0 && next < scenario.rescueTo) {
      next = scenario.rescueTo
    }

    next = Math.min(next, scenario.cap)
    next = roundValue(next, scenario.rounding)

    return clamp(next, 0, maxScore)
  }

  const scenarioRows = scoredRows.map((row) => {
    const adjust = shouldAdjustStudent(row.id, row.original)
    const simulated = simulateScore(row.original, selectedMaxScore, adjust)

    return {
      ...row,
      simulated,
      delta: simulated - row.original,
      adjusted: adjust,
    }
  })

  const originalAvg =
    scenarioRows.length > 0
      ? scenarioRows.reduce((sum, row) => sum + row.original, 0) / scenarioRows.length
      : 0

  const simulatedAvg =
    scenarioRows.length > 0
      ? scenarioRows.reduce((sum, row) => sum + row.simulated, 0) / scenarioRows.length
      : 0

  const originalPassRate =
    scenarioRows.length > 0
      ? (scenarioRows.filter((row) => row.original >= scenario.passThreshold).length / scenarioRows.length) * 100
      : 0

  const simulatedPassRate =
    scenarioRows.length > 0
      ? (scenarioRows.filter((row) => row.simulated >= scenario.passThreshold).length / scenarioRows.length) * 100
      : 0

  const originalDistinctionRate =
    scenarioRows.length > 0
      ? (scenarioRows.filter((row) => row.original >= distinctionThreshold).length / scenarioRows.length) * 100
      : 0

  const simulatedDistinctionRate =
    scenarioRows.length > 0
      ? (scenarioRows.filter((row) => row.simulated >= distinctionThreshold).length / scenarioRows.length) * 100
      : 0

  const impactedStudentCount = scenarioRows.filter((row) => Math.abs(row.delta) > 0.01).length
  const largestLift = scenarioRows.reduce((max, row) => Math.max(max, row.delta), 0)

  const distribution = DISTRIBUTION_BINS.map((bin) => ({
    range: bin,
    Original: scenarioRows.filter((row) => getDistributionBin(row.original, selectedMaxScore) === bin).length,
    Simulated: scenarioRows.filter((row) => getDistributionBin(row.simulated, selectedMaxScore) === bin).length,
  }))

  const sectionImpact =
    activeScope === "course"
      ? scopedSections.map((section) => {
          const rows = scenarioRows.filter((row) => row.sectionId === section.id)
          const originalMean = rows.length ? rows.reduce((sum, row) => sum + row.original, 0) / rows.length : 0
          const simulatedMean = rows.length ? rows.reduce((sum, row) => sum + row.simulated, 0) / rows.length : 0

          return {
            section: section.label,
            Original: originalMean,
            Simulated: simulatedMean,
            Delta: simulatedMean - originalMean,
            Students: rows.length,
          }
        })
      : []

  const componentImpact =
    activeAssessment === "all"
      ? assessments.map((assessment) => {
          const rows = scenarioRows.map((row) => {
            const raw = row.marks[assessment.id] ?? 0
            const originalPercentage = assessment.maxMarks > 0 ? (raw / assessment.maxMarks) * 100 : 0
            const simulatedPercentage = simulateScore(
              originalPercentage,
              100,
              shouldAdjustStudent(row.id, row.original)
            )

            return {
              originalPercentage,
              simulatedPercentage,
            }
          })

          const originalMean = rows.length
            ? rows.reduce((sum, row) => sum + row.originalPercentage, 0) / rows.length
            : 0
          const simulatedMean = rows.length
            ? rows.reduce((sum, row) => sum + row.simulatedPercentage, 0) / rows.length
            : 0

          return {
            component: assessment.name,
            Original: originalMean,
            Simulated: simulatedMean,
          }
        })
      : []

  const mostAffectedStudents = [...scenarioRows]
    .sort((left, right) => right.delta - left.delta)
    .slice(0, 8)

  const scopeLabel =
    activeScope === "course"
      ? "Whole course"
      : scopedSections[0]?.label ?? "Selected class"

  const componentLabel =
    activeAssessment === "all"
      ? "All weighted components"
      : selectedAssessment
        ? `${selectedAssessment.name} (${selectedAssessment.maxMarks} max)`
        : "Selected component"

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((item) => item.id === presetId)
    if (!preset) return

    const next = preset.apply(selectedMaxScore)
    setScenarioState({
      selectionKey,
      bonus: Number(next.bonus.toFixed(1)),
      scale: Number(next.scale.toFixed(2)),
      minimumScore: Number(next.minimumScore.toFixed(1)),
      rescueTo: Number(next.rescueTo.toFixed(1)),
      cap: Number(next.cap.toFixed(1)),
      population: next.population,
      passThreshold: scenario.passThreshold,
      rounding: next.rounding,
    })
  }

  const resetControls = () => {
    setScenarioState(createScenarioState(selectedMaxScore, selectionKey))
  }

  if (!sections.length || !assessments.length) {
    return (
      <Card className="border-dashed border-2 bg-slate-50 dark:bg-slate-900/50">
        <CardContent className="flex h-48 flex-col items-center justify-center text-center text-muted-foreground">
          <BarChart3 className="mb-4 h-8 w-8 text-muted-foreground/70" />
          <p className="font-medium">This workspace needs sections and assessment components before scenario analysis can open up properly.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs uppercase tracking-wide">
              {roleView === "mentor" ? "Mentor lab" : "Faculty lab"}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
              {workspaceCode}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
              {scopeLabel}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
              {componentLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {courseScopeAllowed ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Analysis scope</Label>
              <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={activeScope === "course" ? "default" : "outline"}
                    onClick={() => setScopePreference("course")}
                  >
                    Whole Course
                  </Button>
                {sections.map((section) => (
                  <Button
                    key={section.id}
                    type="button"
                    size="sm"
                    variant={activeScope === section.id ? "default" : "outline"}
                    onClick={() => setScopePreference(section.id)}
                  >
                    {section.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Analysis scope</Label>
              <div className="flex flex-wrap gap-2">
                {sections.map((section) => (
                  <Badge key={section.id} variant="secondary" className="rounded-full px-3 py-1 text-sm">
                    {section.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Assessment target</Label>
            <div className="flex flex-wrap gap-2">
              {assessments.length > 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={activeAssessment === "all" ? "default" : "outline"}
                    onClick={() => setAssessmentPreference("all")}
                  >
                    All weighted components
                  </Button>
              ) : null}
              {assessments.map((assessment) => (
                <Button
                  key={assessment.id}
                  type="button"
                  size="sm"
                  variant={activeAssessment === assessment.id ? "default" : "outline"}
                  onClick={() => setAssessmentPreference(assessment.id)}
                >
                  {assessment.name}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <WandSparkles className="h-4 w-4 text-primary" />
              Scenario levers
            </CardTitle>
            <CardDescription>
              Tune the scenario, focus it on a subset of students, and compare how the class or course shifts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Quick presets</Label>
              <div className="grid gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className="rounded-xl border border-border/70 bg-background px-3 py-3 text-left transition hover:border-primary/40 hover:bg-accent/40"
                  >
                    <div className="text-sm font-semibold text-foreground">{preset.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Target population</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "everyone", label: "Everyone" },
                  { id: "belowTarget", label: "Below target" },
                  { id: "topThird", label: "Top third" },
                ].map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    size="sm"
                    variant={scenario.population === option.id ? "default" : "outline"}
                    onClick={() => setScenarioState({ ...scenario, selectionKey, population: option.id as TargetPopulation })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pass-threshold">Target line</Label>
                <Input
                  id="pass-threshold"
                  type="number"
                  value={scenario.passThreshold}
                  max={selectedMaxScore}
                  onChange={(event) =>
                    setScenarioState({
                      ...scenario,
                      selectionKey,
                      passThreshold: clamp(Number(event.target.value || 0), 0, selectedMaxScore),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cap">Cap</Label>
                <Input
                  id="cap"
                  type="number"
                  value={scenario.cap}
                  max={selectedMaxScore}
                  onChange={(event) =>
                    setScenarioState({
                      ...scenario,
                      selectionKey,
                      cap: clamp(Number(event.target.value || 0), 0, selectedMaxScore),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="bonus" className="text-sm font-medium">
                  Flat bonus
                </Label>
                <span className="text-xs font-medium text-muted-foreground">
                  {scenario.bonus > 0 ? "+" : ""}
                  {scenario.bonus.toFixed(1)}
                </span>
              </div>
              <Input
                id="bonus"
                type="range"
                min={-selectedMaxScore * 0.3}
                max={selectedMaxScore * 0.3}
                step={0.5}
                value={scenario.bonus}
                onChange={(event) =>
                  setScenarioState({
                    ...scenario,
                    selectionKey,
                    bonus: Number(event.target.value),
                  })
                }
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="scale" className="text-sm font-medium">
                  Multiplier
                </Label>
                <span className="text-xs font-medium text-muted-foreground">{scenario.scale.toFixed(2)}x</span>
              </div>
              <Input
                id="scale"
                type="range"
                min={0.5}
                max={1.5}
                step={0.01}
                value={scenario.scale}
                onChange={(event) =>
                  setScenarioState({
                    ...scenario,
                    selectionKey,
                    scale: Number(event.target.value),
                  })
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minimum-score">Minimum guaranteed score</Label>
                <Input
                  id="minimum-score"
                  type="number"
                  value={scenario.minimumScore}
                  max={selectedMaxScore}
                  onChange={(event) =>
                    setScenarioState({
                      ...scenario,
                      selectionKey,
                      minimumScore: clamp(Number(event.target.value || 0), 0, selectedMaxScore),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rescue-to">Rescue to</Label>
                <Input
                  id="rescue-to"
                  type="number"
                  value={scenario.rescueTo}
                  max={selectedMaxScore}
                  onChange={(event) =>
                    setScenarioState({
                      ...scenario,
                      selectionKey,
                      rescueTo: clamp(Number(event.target.value || 0), 0, selectedMaxScore),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Rounding mode</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "none", label: "No rounding" },
                  { id: "half", label: "0.5 steps" },
                  { id: "whole", label: "Whole marks" },
                ].map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    size="sm"
                    variant={scenario.rounding === option.id ? "default" : "outline"}
                    onClick={() => setScenarioState({ ...scenario, selectionKey, rounding: option.id as RoundingMode })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={resetControls}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset scenario
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Gauge}
              label="Average"
              original={originalAvg}
              simulated={simulatedAvg}
              maxScore={selectedMaxScore}
            />
            <MetricCard
              icon={Target}
              label="Pass rate"
              original={originalPassRate}
              simulated={simulatedPassRate}
              suffix="%"
            />
            <MetricCard
              icon={GraduationCap}
              label="Distinction rate"
              original={originalDistinctionRate}
              simulated={simulatedDistinctionRate}
              suffix="%"
            />
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Scenario impact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-3xl font-semibold">{impactedStudentCount}</div>
                  <div className="text-xs text-muted-foreground">students moved by this scenario</div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Largest lift: <span className="font-semibold text-foreground">{largestLift.toFixed(1)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Distribution shift</CardTitle>
                <CardDescription>
                  See how the selected group moves across performance bands.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: CHART_THEME.axis, fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART_THEME.axis, fontSize: 12 }} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: CHART_THEME.cursor }} />
                    <Legend />
                    <Bar dataKey="Original" fill={CHART_SERIES_COLORS[0]} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Simulated" fill={CHART_SERIES_COLORS[2]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Scenario readout</CardTitle>
                <CardDescription>
                  A quick summary of what this manipulation recipe is currently doing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScenarioRow label="Scope" value={scopeLabel} />
                <ScenarioRow label="Component target" value={componentLabel} />
                <ScenarioRow
                  label="Population"
                  value={
                    scenario.population === "everyone"
                      ? "Everyone"
                      : scenario.population === "belowTarget"
                        ? `Only students below ${scenario.passThreshold.toFixed(1)}`
                        : "Only the top third"
                  }
                />
                <ScenarioRow label="Flat bonus" value={`${scenario.bonus > 0 ? "+" : ""}${scenario.bonus.toFixed(1)}`} />
                <ScenarioRow label="Scale" value={`${scenario.scale.toFixed(2)}x`} />
                <ScenarioRow label="Minimum score" value={scenario.minimumScore.toFixed(1)} />
                <ScenarioRow label="Rescue line" value={scenario.rescueTo > 0 ? scenario.rescueTo.toFixed(1) : "Off"} />
                <ScenarioRow label="Cap" value={scenario.cap.toFixed(1)} />
                <ScenarioRow
                  label="Rounding"
                  value={scenario.rounding === "none" ? "Off" : scenario.rounding === "half" ? "0.5 steps" : "Whole marks"}
                />
              </CardContent>
            </Card>
          </div>

          {activeScope === "course" && sectionImpact.length > 1 ? (
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers3 className="h-4 w-4 text-primary" />
                  Section impact
                </CardTitle>
                <CardDescription>
                  Compare how the course-level scenario changes section means.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectionImpact} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="section" axisLine={false} tickLine={false} tick={{ fill: CHART_THEME.axis, fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART_THEME.axis, fontSize: 12 }} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: CHART_THEME.cursor }} />
                    <Legend />
                    <Bar dataKey="Original" fill={CHART_SERIES_COLORS[4]} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Simulated" fill={CHART_SERIES_COLORS[6]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}

          {activeAssessment === "all" && componentImpact.length > 1 ? (
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Component impact overview</CardTitle>
                <CardDescription>
                  When the scenario is applied across the course, this shows how each component&apos;s average percentage shifts.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={componentImpact} margin={{ top: 12, right: 16, left: 0, bottom: 24 }}>
                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="component" axisLine={false} tickLine={false} tick={{ fill: CHART_THEME.axis, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={56} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART_THEME.axis, fontSize: 12 }} domain={[0, 100]} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: CHART_THEME.cursor }} />
                    <Legend />
                    <Bar dataKey="Original" fill={CHART_SERIES_COLORS[1]} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Simulated" fill={CHART_SERIES_COLORS[3]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Most affected students</CardTitle>
              <CardDescription>
                The biggest upward moves in the current simulation scope.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Roll Number</th>
                    <th className="pb-3 pr-4 font-medium">Student</th>
                    <th className="pb-3 pr-4 font-medium">Section</th>
                    <th className="pb-3 pr-4 font-medium">Original</th>
                    <th className="pb-3 pr-4 font-medium">Simulated</th>
                    <th className="pb-3 font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {mostAffectedStudents.map((student) => (
                    <tr key={student.id} className="border-b border-border/50 last:border-b-0">
                      <td className="py-3 pr-4 font-mono text-xs">{student.rollNo}</td>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-foreground">{student.name}</div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{student.sectionLabel}</td>
                      <td className="py-3 pr-4">{student.original.toFixed(1)}</td>
                      <td className="py-3 pr-4 font-semibold text-foreground">{student.simulated.toFixed(1)}</td>
                      <td
                        className={cn(
                          "py-3 font-medium",
                          student.delta > 0.01
                            ? "text-emerald-600 dark:text-emerald-400"
                            : student.delta < -0.01
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground"
                        )}
                      >
                        {student.delta > 0 ? "+" : ""}
                        {student.delta.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  original,
  simulated,
  maxScore,
  suffix = "",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  original: number
  simulated: number
  maxScore?: number
  suffix?: string
}) {
  const delta = simulated - original

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="text-3xl font-semibold text-foreground">
            {simulated.toFixed(1)}
            {suffix}
          </div>
          <div
            className={cn(
              "text-sm font-medium",
              delta > 0.01
                ? "text-emerald-600 dark:text-emerald-400"
                : delta < -0.01
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-muted-foreground"
            )}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}
            {suffix}
          </div>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>Original: {original.toFixed(1)}{suffix}</div>
          {typeof maxScore === "number" ? <div>Scale: out of {maxScore.toFixed(0)}</div> : null}
        </div>
      </CardContent>
    </Card>
  )
}

function ScenarioRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 px-3 py-2.5">
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="text-right text-sm text-muted-foreground">{value}</div>
    </div>
  )
}
