"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Pencil, Save, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { saveStudentMark } from "../marks/actions"
import { getErrorMessage } from "@/lib/client-errors"
import type { WorkspaceRoleView } from "@/lib/course-workspace"

type AssessmentRecord = {
  markId: string | null
  assessmentId: string
  assessmentName: string
  assessmentCode: string
  maxMarks: number
  weightage: number
  marks: number | null
}

type StudentRecord = {
  id: string
  rollNo: string
  name: string
  sectionName: string
}

export function WorkspaceStudentRecordClient({
  student,
  roleView,
  workspaceLabel,
  assessments,
}: {
  student: StudentRecord
  roleView: WorkspaceRoleView
  workspaceLabel: string
  assessments: AssessmentRecord[]
}) {
  const router = useRouter()
  const [savingAssessmentId, setSavingAssessmentId] = useState<string | null>(null)
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null)
  const [dirtyMarks, setDirtyMarks] = useState<Record<string, string>>({})

  const totalRecorded = useMemo(
    () => assessments.filter((assessment) => assessment.marks !== null).length,
    [assessments]
  )

  const runningTotal = useMemo(() => {
    const recordedAssessments = assessments.filter(
      (assessment) => assessment.marks !== null && assessment.maxMarks > 0 && assessment.weightage > 0
    )
    const earned = recordedAssessments.reduce(
      (sum, assessment) => sum + ((assessment.marks ?? 0) / assessment.maxMarks) * assessment.weightage,
      0
    )
    const weightageSoFar = recordedAssessments.reduce((sum, assessment) => sum + assessment.weightage, 0)
    return {
      earned,
      weightageSoFar,
    }
  }, [assessments])

  const formatScore = (value: number) => {
    const rounded = Number(value.toFixed(1))
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1)
  }

  const handleMarkChange = (assessmentId: string, value: string) => {
    setDirtyMarks((previous) => ({ ...previous, [assessmentId]: value }))
  }

  const handleEditStart = (assessment: AssessmentRecord) => {
    setEditingAssessmentId(assessment.assessmentId)
    setDirtyMarks((previous) => ({
      ...previous,
      [assessment.assessmentId]:
        previous[assessment.assessmentId] ?? (assessment.marks !== null ? assessment.marks.toString() : ""),
    }))
  }

  const handleEditCancel = (assessmentId: string) => {
    setEditingAssessmentId((current) => (current === assessmentId ? null : current))
    setDirtyMarks((previous) => {
      const next = { ...previous }
      delete next[assessmentId]
      return next
    })
  }

  const handleSave = async (assessmentId: string) => {
    const value = dirtyMarks[assessmentId]
    if (value === undefined) return

    setSavingAssessmentId(assessmentId)
    try {
      await saveStudentMark(student.id, assessmentId, value)
      toast.success("Component mark updated")
      setDirtyMarks((previous) => {
        const next = { ...previous }
        delete next[assessmentId]
        return next
      })
      setEditingAssessmentId((current) => (current === assessmentId ? null : current))
      router.refresh()
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update component mark"))
    } finally {
      setSavingAssessmentId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">
          <Link href="/dashboard/students" className="hover:underline">
            Students
          </Link>
          {" / "}Subject Record
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{student.name}</h1>
        <p className="font-mono text-sm text-slate-500">{student.rollNo}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Current Class</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{student.sectionName}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Subject Scope</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{workspaceLabel}</div>
            <p className="mt-1 text-xs text-slate-500">
              {roleView === "faculty" ? "Faculty-scoped record" : "Mentor-scoped record"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Components Recorded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {totalRecorded} / {assessments.length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/25 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_10%,transparent),color-mix(in_srgb,var(--card)_94%,transparent))] shadow-[0_12px_30px_color-mix(in_srgb,var(--primary)_10%,transparent)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">Running Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-primary">
              {formatScore(runningTotal.earned)} / {formatScore(runningTotal.weightageSoFar)}
            </div>
            <p className="mt-1 text-xs text-slate-500">Based only on the components recorded so far</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subject Component Record</CardTitle>
          <CardDescription>
            This record is limited to the currently selected subject workspace. Marks stay locked until you explicitly open one component for editing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
              No assessment components are configured for this subject yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assessments.map((assessment) => {
                const isEditing = editingAssessmentId === assessment.assessmentId
                const isDirty = dirtyMarks[assessment.assessmentId] !== undefined
                const currentValue = isDirty
                  ? dirtyMarks[assessment.assessmentId]
                  : assessment.marks?.toString() ?? ""

                return (
                  <div
                    key={assessment.assessmentId}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          {assessment.assessmentName}
                        </div>
                        <div className="mt-1 font-mono text-xs text-slate-500">
                          {assessment.assessmentCode}
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditCancel(assessment.assessmentId)}
                            className="h-8 w-8 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={savingAssessmentId === assessment.assessmentId}
                            onClick={() => handleSave(assessment.assessmentId)}
                            className="h-8 w-8 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEditStart(assessment)}
                          className="h-8 w-8 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="mt-5">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max={assessment.maxMarks}
                            value={currentValue}
                            onChange={(event) => handleMarkChange(assessment.assessmentId, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && isDirty) {
                                handleSave(assessment.assessmentId)
                              }
                            }}
                            className="h-14 text-center text-2xl font-semibold"
                          />
                          <div className="text-center text-xs text-slate-500">
                            Editing mark out of {assessment.maxMarks}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                            {assessment.marks !== null ? assessment.marks : "—"}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            out of {assessment.maxMarks}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-white/80 px-3 py-2 dark:bg-slate-950/40">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Weightage</div>
                        <div className="mt-1 font-medium text-slate-700 dark:text-slate-300">{assessment.weightage}</div>
                      </div>
                      <div className="rounded-lg bg-white/80 px-3 py-2 dark:bg-slate-950/40">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Status</div>
                        <div className="mt-1 font-medium text-slate-700 dark:text-slate-300">
                          {assessment.marks !== null ? "Recorded" : "Pending"}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
