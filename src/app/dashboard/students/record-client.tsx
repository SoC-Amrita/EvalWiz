"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeftRight } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { updateStudentRecord } from "./actions"
import { getErrorMessage } from "@/lib/client-errors"

type Section = {
  id: string
  name: string
}

type StudentRecord = {
  id: string
  rollNo: string
  name: string
  section: Section
}

type SubjectMarkGroup = {
  offeringId: string
  subjectCode: string
  subjectTitle: string
  term: string
  academicYear: string
  semester: string
  year: string
  evaluationPattern: string
  courseType: string
  marks: Array<{
    markId: string
    assessmentId: string
    assessmentName: string
    assessmentCode: string
    maxMarks: number
    weightage: number
    marks: number
  }>
}

export function StudentRecordClient({
  student,
  sections,
  subjectGroups,
}: {
  student: StudentRecord
  sections: Section[]
  subjectGroups: SubjectMarkGroup[]
}) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState(student.section.id)
  const [saving, setSaving] = useState(false)

  const handleChangeAssignment = async () => {
    setSaving(true)
    try {
      await updateStudentRecord({
        studentId: student.id,
        rollNo: student.rollNo,
        name: student.name,
        sectionId: selectedSectionId,
      })
      toast.success("Class assignment updated")
      setDialogOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to change class assignment"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            <Link href="/dashboard/students" className="hover:underline">
              Student Master List
            </Link>
            {" / "}Student Record
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{student.name}</h1>
          <p className="font-mono text-sm text-slate-500">{student.rollNo}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button variant="outline" />}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Change Class Assignment
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Change Class Assignment</DialogTitle>
              <DialogDescription>
                Admin manual override: move this student into any class or section without changing the centralized student identity.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                <div className="font-medium text-slate-900 dark:text-slate-100">{student.name}</div>
                <div className="font-mono text-xs">{student.rollNo}</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-record-section">Class / Section</Label>
                <select
                  id="student-record-section"
                  value={selectedSectionId}
                  onChange={(event) => setSelectedSectionId(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={handleChangeAssignment} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {saving ? "Saving..." : "Save Assignment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Current Class</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{student.section.name}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Subjects Recorded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{subjectGroups.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Mark Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {subjectGroups.reduce((sum, group) => sum + group.marks.length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Complete Subject Record</CardTitle>
          <CardDescription>
            This view aggregates all subject-level marks currently linked to this student record across offerings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subjectGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
              No marks are recorded for this student yet.
            </div>
          ) : (
            subjectGroups.map((group) => (
              <div key={group.offeringId} className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{group.subjectCode}</Badge>
                      <Badge variant="secondary">{group.term}</Badge>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{group.subjectTitle}</h2>
                    <p className="text-sm text-slate-500">
                      {group.academicYear} · {group.semester} Semester · Year {group.year} · {group.courseType} · {group.evaluationPattern}
                    </p>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
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
                      {group.marks.map((mark) => (
                        <tr key={mark.markId} className="border-t border-slate-200 dark:border-slate-800">
                          <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{mark.assessmentName}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{mark.assessmentCode}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">{mark.maxMarks}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">{mark.weightage}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">{mark.marks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
