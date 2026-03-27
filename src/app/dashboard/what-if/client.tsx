"use client"

import { useState, useEffect } from "react"
import type { Section, Assessment } from "@prisma/client"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { fetchSectionData } from "../marks/fetcher"
import { toast } from "sonner"
import { Undo2, Beaker, Check, Maximize2, Scale } from "lucide-react"

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Legend
} from "recharts"

type StudentRow = { id: string; rollNo: string; name: string; mark: number | null }
type TooltipPayloadEntry = { color?: string; name?: string; value?: number }
type TooltipProps = { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/90 border border-slate-700 p-3 rounded-lg shadow-xl text-white text-xs backdrop-blur-sm">
        <p className="font-bold text-sm mb-2">{label}</p>
        {payload.map((p, i: number) => (
          <div key={i} className="flex items-center space-x-2 my-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-300">{p.name}:</span>
            <span className="font-medium text-white">{p.value?.toFixed(1) ?? "0.0"}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function WhatIfClient({ 
  sections, 
  assessments 
}: { 
  sections: Section[], 
  assessments: Assessment[] 
}) {
  const [activeSection, setActiveSection] = useState<string>("")
  const [activeAssessment, setActiveAssessment] = useState<string>("")
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(false)

  // Simulation parameters
  const [bonus, setBonus] = useState<number>(0)
  const [scale, setScale] = useState<number>(1)
  const [cap, setCap] = useState<number | "">("")

  const activeAssessmentDetails = assessments.find(a => a.id === activeAssessment)

  useEffect(() => {
    const loadData = async () => {
      if (!activeSection || !activeAssessment) return
      setLoading(true)
      try {
        const data = await fetchSectionData(activeSection, activeAssessment)
        setStudents(data)
        setBonus(0)
        setScale(1)
        setCap(activeAssessmentDetails?.maxMarks ?? "")
      } catch {
        toast.error("Failed to load students")
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [activeSection, activeAssessment, activeAssessmentDetails?.maxMarks])

  const simulatedData = students.map(s => {
    const original = s.mark ?? 0
    let simulated = (original * scale) + bonus
    if (cap !== "" && simulated > Number(cap)) {
      simulated = Number(cap)
    }
    return {
      rollNo: s.rollNo,
      original,
      simulated,
      diff: simulated - original
    }
  }).filter(s => s.original !== 0 || s.simulated !== 0)

  const originalAvg = simulatedData.length > 0 
    ? simulatedData.reduce((acc, curr) => acc + curr.original, 0) / simulatedData.length 
    : 0

  const simulatedAvg = simulatedData.length > 0 
    ? simulatedData.reduce((acc, curr) => acc + curr.simulated, 0) / simulatedData.length 
    : 0

  // Distribution bins (0-20%, 20-40%, 40-60%, 60-80%, 80-100%)
  const getBin = (mark: number, max: number) => {
    if (max === 0) return "0%"
    const p = (mark / max) * 100
    if (p < 20) return "0-20%"
    if (p < 40) return "20-40%"
    if (p < 60) return "40-60%"
    if (p < 80) return "60-80%"
    return "80-100%"
  }

  const distribution = ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"].map(bin => {
    const origCount = simulatedData.filter(s => getBin(s.original, activeAssessmentDetails?.maxMarks ?? 100) === bin).length
    const simCount = simulatedData.filter(s => getBin(s.simulated, activeAssessmentDetails?.maxMarks ?? 100) === bin).length
    return { range: bin, Original: origCount, Simulated: simCount }
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Section</label>
          <Select value={activeSection} onValueChange={(val) => setActiveSection(val || "")}>
            <SelectTrigger className="bg-white dark:bg-slate-900">
              {activeSection ? sections.find(s => s.id === activeSection)?.name || "" : <span className="text-slate-500">Choose section...</span>}
            </SelectTrigger>
            <SelectContent>
              {sections.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Assessment</label>
          <Select value={activeAssessment} onValueChange={(val) => setActiveAssessment(val || "")}>
            <SelectTrigger className="bg-white dark:bg-slate-900">
              {activeAssessment ? `${assessments.find(a => a.id === activeAssessment)?.name} (${assessments.find(a => a.id === activeAssessment)?.maxMarks} max)` : <span className="text-slate-500">Choose component...</span>}
            </SelectTrigger>
            <SelectContent>
              {assessments.map(a => (
                <SelectItem key={a.id} value={a.id}>{`${a.name} (${a.maxMarks} max)`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!activeSection || !activeAssessment ? (
        <Card className="border-dashed border-2 bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="flex flex-col items-center justify-center h-48 text-slate-500">
            <Beaker className="w-8 h-8 mb-4 text-slate-400" />
            <p className="font-medium">Select a section and assessment to begin simulation</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="h-48 flex items-center justify-center text-slate-500">Loading data...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-12">
          {/* Controls */}
          <Card className="md:col-span-4 bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-lg">Simulation Controls</CardTitle>
              <CardDescription>Adjust variables to see impact non-destructively.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bonus" className="flex items-center text-indigo-700 dark:text-indigo-400 font-medium">
                    <Check className="w-4 h-4 mr-2" /> Flat Bonus
                  </Label>
                  <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">+{bonus} marks</span>
                </div>
                <Input 
                  id="bonus" 
                  type="range" 
                  min="-20" 
                  max="20" 
                  step="0.5" 
                  value={bonus} 
                  onChange={(e) => setBonus(Number(e.target.value))} 
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>-20</span>
                  <span>0</span>
                  <span>+20</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="scale" className="flex items-center text-emerald-700 dark:text-emerald-400 font-medium">
                    <Scale className="w-4 h-4 mr-2" /> Multiplier Scale
                  </Label>
                  <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{scale}x</span>
                </div>
                <Input 
                  id="scale" 
                  type="range" 
                  min="0" 
                  max="3" 
                  step="0.05" 
                  value={scale} 
                  onChange={(e) => setScale(Number(e.target.value))} 
                  className="w-full accent-emerald-600"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>0x</span>
                  <span>1x</span>
                  <span>3x</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cap" className="flex items-center text-amber-700 dark:text-amber-500 font-medium">
                    <Maximize2 className="w-4 h-4 mr-2" /> Maximum Cap
                  </Label>
                </div>
                <Input 
                  id="cap" 
                  type="number" 
                  value={cap} 
                  max={activeAssessmentDetails?.maxMarks}
                  onChange={(e) => setCap(e.target.value ? Number(e.target.value) : "")} 
                  className="focus-visible:ring-amber-500"
                  placeholder={`Max: ${activeAssessmentDetails?.maxMarks}`}
                />
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 pt-4 pb-4">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setBonus(0)
                  setScale(1)
                  setCap(activeAssessmentDetails?.maxMarks ?? "")
                }}
              >
                <Undo2 className="w-4 h-4 mr-2" />
                Reset Controls
              </Button>
            </CardFooter>
          </Card>

          {/* Results */}
          <div className="md:col-span-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Original Average</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{originalAvg.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-indigo-700 dark:text-indigo-400">Simulated Average</CardTitle>
                </CardHeader>
                <CardContent className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">{simulatedAvg.toFixed(2)}</div>
                  <div className={`text-sm font-medium ${simulatedAvg > originalAvg ? "text-emerald-600" : simulatedAvg < originalAvg ? "text-rose-600" : "text-slate-500"}`}>
                    {simulatedAvg > originalAvg ? "+" : ""}{(simulatedAvg - originalAvg).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Distribution Comparison</CardTitle>
                <CardDescription>How student marks shift across performance deciles.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="range" axisLine={false} tickLine={false} dy={10} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} dx={-10} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="Original" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Simulated" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
