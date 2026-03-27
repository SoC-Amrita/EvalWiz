"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Save } from "lucide-react"
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
  const [dirtyMarks, setDirtyMarks] = useState<Record<string, string>>({})

  const totalRecorded = useMemo(
    () => assessments.filter((assessment) => assessment.marks !== null).length,
    [assessments]
  )

  const handleMarkChange = (assessmentId: string, value: string) => {
    setDirtyMarks((previous) => ({ ...previous, [assessmentId]: value }))
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

      <div className="grid gap-4 md:grid-cols-3">
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
              {roleView === "faculty" ? "Faculty view" : "Mentor view"}
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subject Component Record</CardTitle>
          <CardDescription>
            This record is limited to the currently selected subject workspace, and each component can be edited directly here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
              No assessment components are configured for this subject yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Assessment</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Code</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-500">Out of</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-500">Weightage</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-500">Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((assessment) => {
                    const isDirty = dirtyMarks[assessment.assessmentId] !== undefined
                    const currentValue = isDirty
                      ? dirtyMarks[assessment.assessmentId]
                      : assessment.marks?.toString() ?? ""

                    return (
                      <tr key={assessment.assessmentId} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{assessment.assessmentName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{assessment.assessmentCode}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">{assessment.maxMarks}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">{assessment.weightage}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
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
                              className={`w-24 text-right ${isDirty ? "border-yellow-400 focus-visible:ring-yellow-400" : ""}`}
                            />
                            {isDirty ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={savingAssessmentId === assessment.assessmentId}
                                onClick={() => handleSave(assessment.assessmentId)}
                                className="h-9 w-9 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                            ) : (
                              <div className="h-9 w-9" />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
