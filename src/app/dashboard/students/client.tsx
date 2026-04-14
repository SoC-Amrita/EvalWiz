"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import Papa from "papaparse"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Upload, Download, AlertCircle, CheckCircle, Search, ChevronRight, Pencil, RotateCcw, ShieldCheck, ShieldX, Trash2 } from "lucide-react"
import {
  approveStudentDeletionRequest,
  createStudentRecord,
  deleteStudentRecord,
  rejectStudentDeletionRequest,
  restoreArchivedStudent,
  updateStudentRecord,
  uploadStudents,
} from "./actions"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/client-errors"
import { parseStudentRollNumber } from "@/lib/roll-number"

type Section = { id: string; name: string }
type StudentSection = Section & {
  semester?: string | null
  programCode?: string | null
  sectionCode?: string | null
}

type Student = {
  id: string
  rollNo: string
  name: string
  excludeFromAnalytics: boolean
  section: StudentSection
}

type PendingDeletionRequest = {
  id: string
  studentId: string | null
  studentRollNo: string
  studentName: string
  sectionName: string
  requestedByName: string
  requestedByUserId: string
  reason: string | null
  createdAt: Date
}

type ArchivedStudent = {
  id: string
  rollNo: string
  name: string
  sectionName: string
  archivedAt: Date
  archiveReason: string
}

type CsvRow = { rollNo: string; name: string; sectionName?: string }
type CsvImportRow = { rollNo?: unknown; name?: unknown; sectionName?: unknown }

function formatCompactSectionLabel(student: Student) {
  const parsedRoll = parseStudentRollNumber(student.rollNo)
  const semester = student.section.semester?.trim() || null
  const programCode = student.section.programCode?.trim().toUpperCase() || parsedRoll?.programCode || null
  const sectionCode = student.section.sectionCode?.trim().toUpperCase() || parsedRoll?.sectionCode || null

  if (semester && programCode && sectionCode) {
    return `${semester} ${programCode} ${sectionCode}`
  }

  return student.section.name
}

// ─── Main component ──────────────────────────────────────────────────────────

export function StudentsClient({
  initialData,
  sections,
  canManageAllSections,
  isElectiveOffering,
  searchQuery,
  currentPage,
  pageCount,
  totalCount,
  pendingDeletionRequests,
  archivedStudents,
}: {
  initialData: Student[]
  sections: Section[]
  canManageAllSections: boolean
  isElectiveOffering: boolean
  searchQuery: string
  currentPage: number
  pageCount: number
  totalCount: number
  pendingDeletionRequests: PendingDeletionRequest[]
  archivedStudents: ArchivedStudent[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [addStudentOpen, setAddStudentOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [parsedData, setParsedData] = useState<CsvRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filter / search state
  const [search, setSearch] = useState(searchQuery)
  const deferredSearch = useDeferredValue(search)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null)
  const pendingDeletionStudentIds = useMemo(
    () => new Set(pendingDeletionRequests.map((request) => request.studentId).filter((studentId): studentId is string => Boolean(studentId))),
    [pendingDeletionRequests]
  )

  const handleEditAnalyticsIncludedChange = (checked: boolean) => {
    if (!checked) {
      const confirmed = window.confirm(
        "Exclude this student from analytics? The student will be removed from analytics and report calculations globally."
      )
      if (!confirmed) return
    }

    setEditingStudent((current) =>
      current ? { ...current, excludeFromAnalytics: !checked } : current
    )
  }

  useEffect(() => {
    setSearch(searchQuery)
  }, [searchQuery])

  const navigateWithParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value && value.trim().length > 0) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })

    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname)
  }, [pathname, router, searchParams])

  useEffect(() => {
    const nextQuery = deferredSearch.trim()
    if (nextQuery === searchQuery) return
    navigateWithParams({
      q: nextQuery || null,
      page: null,
    })
  }, [deferredSearch, navigateWithParams, searchQuery])

  const pageSummary = totalCount === 0
    ? "No students found"
    : `Showing ${initialData.length} of ${totalCount} students`

  // CSV processing
  const processFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: CsvRow[] = []
        const rowErrs: string[] = []
        results.data.forEach((row, i) => {
          const parsedRow = row as CsvImportRow
          if (!parsedRow.rollNo || !parsedRow.name) {
            rowErrs.push(`Row ${i + 1}: Missing required columns (rollNo, name)`)
          } else {
            rows.push({
              rollNo: String(parsedRow.rollNo).trim(),
              name: String(parsedRow.name).trim(),
              sectionName: parsedRow.sectionName ? String(parsedRow.sectionName).trim() : undefined,
            })
          }
        })
        setParsedData(rows)
        setErrors(rowErrs)
      },
      error: (err) => setErrors([err.message])
    })
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); setIsDragging(false) }
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) processFile(file)
    else toast.error("Please drop a valid .csv file")
  }

  const submitData = async () => {
    if (parsedData.length === 0) return
    setLoading(true)
    try {
      const result = await uploadStudents(parsedData)
      if (result.errorCount > 0) {
        router.refresh()
        toast.warning(`Uploaded with ${result.errorCount} errors`, { description: "Check the master list. Some rows failed." })
      } else {
        router.refresh()
        toast.success(`Successfully uploaded ${result.successCount} students`)
        setOpen(false); setParsedData([]); setErrors([])
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to upload students"))
    } finally {
      setLoading(false)
    }
  }

  const handleCreateStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    const formData = new FormData(event.currentTarget)

    try {
      await createStudentRecord({
        rollNo: String(formData.get("rollNo") ?? ""),
        name: String(formData.get("name") ?? ""),
        sectionId: String(formData.get("sectionId") ?? ""),
      })
      router.refresh()
      toast.success("Student added")
      setAddStudentOpen(false)
      event.currentTarget.reset()
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to add student"))
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingStudent) return

    setLoading(true)
    const formData = new FormData(event.currentTarget)

    try {
      await updateStudentRecord({
        studentId: editingStudent.id,
        rollNo: String(formData.get("rollNo") ?? ""),
        name: String(formData.get("name") ?? ""),
        sectionId: String(formData.get("sectionId") ?? ""),
        excludeFromAnalytics: formData.get("excludeFromAnalytics") === "on",
      })
      router.refresh()
      toast.success("Student updated")
      setEditingStudent(null)
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update student"))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteStudent = async () => {
    if (!deletingStudent) return

    setLoading(true)
    try {
      await deleteStudentRecord(deletingStudent.id)
      router.refresh()
      toast.success("Student archived and removed from active records")
      setDeletingStudent(null)
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete student"))
    } finally {
      setLoading(false)
    }
  }

  const handleApproveDeletionRequest = async (requestId: string) => {
    if (!window.confirm("Approve this deletion request and archive-delete the student?")) return

    setLoading(true)
    try {
      await approveStudentDeletionRequest(requestId)
      router.refresh()
      toast.success("Deletion request approved")
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to approve deletion request"))
    } finally {
      setLoading(false)
    }
  }

  const handleRejectDeletionRequest = async (requestId: string) => {
    if (!window.confirm("Reject this deletion request?")) return

    setLoading(true)
    try {
      await rejectStudentDeletionRequest(requestId)
      router.refresh()
      toast.success("Deletion request rejected")
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to reject deletion request"))
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreArchivedStudent = async (archivedStudentId: string) => {
    if (!window.confirm("Restore this archived student and their associated records?")) return

    setLoading(true)
    try {
      await restoreArchivedStudent(archivedStudentId)
      router.refresh()
      toast.success("Student restored")
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to restore archived student"))
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob(
      [
        isElectiveOffering
          ? "rollNo,name\nCB.SC.U4CSE23301,John Doe"
          : "rollNo,name\nCB.SC.U4CSE23301,John Doe",
      ],
      { type: "text/csv;charset=utf-8;" }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "students_template.csv"
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mb-3">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Global Search</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Search the student master list by roll number or name. Results are fetched page by page from the server.
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by roll number or student name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 pl-9 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
            {pageSummary}
            <div className="mt-1 text-xs text-slate-500">
              Page {currentPage} of {pageCount}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Badge variant="outline" className="chip-soft-primary px-3 py-1 font-mono text-xs whitespace-nowrap">
              {initialData.length} shown
            </Badge>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("")
                navigateWithParams({ q: null, page: null })
              }}
            >
              Reset Search
            </Button>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2 text-slate-500" />
              Template
            </Button>
            <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
              <DialogTrigger render={
                <Button variant="outline" className="whitespace-nowrap">
                  Add Student
                </Button>
              } />
              <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle>Add Student</DialogTitle>
                  <DialogDescription>
                    Admin manual override: create a student record directly and place the student into any existing class / section.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateStudent}>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="create-student-roll">Roll Number</Label>
                      <Input id="create-student-roll" name="rollNo" placeholder="CB.SC.U4CSE23310" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-student-name">Name</Label>
                      <Input id="create-student-name" name="name" placeholder="Student name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-student-section">Class / Section</Label>
                      <select
                        id="create-student-section"
                        name="sectionId"
                        required
                        defaultValue=""
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="" disabled>
                          Select class / section
                        </option>
                        {sections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setAddStudentOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      {loading ? "Adding..." : "Add Student"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 whitespace-nowrap">
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV
                </Button>
              } />
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Import Students</DialogTitle>
                  <DialogDescription>
                    {isElectiveOffering
                      ? "Upload a CSV file with rollNo and name. The roster will be placed into the single elective class for this offering."
                      : canManageAllSections
                        ? "Upload global student records with rollNo and name only. Regular class assignment is derived from the roll number."
                        : "Upload a CSV file for your assigned sections only, using rollNo and name. Regular class assignment is derived from the roll number."}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <label
                    htmlFor="dropzone-file"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 ${isDragging ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-300 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"} border-dashed rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                  >
                    <Upload className={`w-8 h-8 mb-2 ${isDragging ? "text-indigo-500" : "text-slate-400"}`} />
                    <p className="text-sm text-slate-500"><span className="font-medium text-indigo-600">Click to upload</span> or drag and drop</p>
                    <input id="dropzone-file" type="file" accept=".csv" className="hidden" onChange={handleFileUpload} ref={fileInputRef} />
                  </label>
                  {isElectiveOffering ? (
                    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                      Elective offering mode: all uploaded students will go into the one elective class created for this offering. No section column is needed in the CSV.
                    </div>
                  ) : null}

                  {errors.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center text-red-800 mb-1 font-medium text-sm"><AlertCircle className="w-4 h-4 mr-2" />Errors</div>
                      <ul className="text-xs text-red-600 list-disc pl-5 max-h-24 overflow-y-auto">
                        {errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                  {parsedData.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center mb-2 font-medium text-sm text-emerald-700"><CheckCircle className="w-4 h-4 mr-2" />Valid Rows: {parsedData.length}</div>
                      <ScrollArea className="h-32 border rounded-md">
                        <Table className="text-xs">
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="h-8">Roll No</TableHead>
                              <TableHead className="h-8">Name</TableHead>
                              <TableHead className="h-8">Section Hint</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedData.slice(0, 10).map((r, i) => (
                              <TableRow key={i}>
                              <TableCell className="py-1">{r.rollNo}</TableCell>
                              <TableCell className="py-1">{r.name}</TableCell>
                              <TableCell className="py-1">{isElectiveOffering ? "Single elective class" : "Auto from roll number"}</TableCell>
                            </TableRow>
                          ))}
                            {parsedData.length > 10 && (
                              <TableRow>
                                <TableCell colSpan={3} className="py-2 text-center text-slate-400">+ {parsedData.length - 10} more rows</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setParsedData([]); setErrors([]); setOpen(false) }}>Cancel</Button>
                  <Button onClick={submitData} disabled={loading || parsedData.length === 0} className="bg-indigo-600 hover:bg-indigo-700">
                    {loading ? "Importing…" : "Confirm Import"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {(pendingDeletionRequests.length > 0 || archivedStudents.length > 0) ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-amber-950 dark:text-amber-100">Pending Deletion Requests</div>
                <div className="text-xs text-amber-800/80 dark:text-amber-200/80">
                  Mentor-submitted requests that require admin approval before a student is archived and removed.
                </div>
              </div>
              <Badge variant="outline" className="border-amber-300 bg-white/70 font-mono text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                {pendingDeletionRequests.length}
              </Badge>
            </div>

            {pendingDeletionRequests.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-amber-300/70 px-4 py-6 text-sm text-amber-800 dark:border-amber-800/80 dark:text-amber-200">
                No pending deletion requests.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {pendingDeletionRequests.map((request) => (
                  <div key={request.id} className="rounded-lg border border-amber-200 bg-white/85 p-3 dark:border-amber-900/60 dark:bg-slate-950/40">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{request.studentName}</div>
                        <div className="font-mono text-xs text-slate-500">{request.studentRollNo}</div>
                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          {request.sectionName} · requested by {request.requestedByName}
                        </div>
                        {request.reason ? (
                          <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                            Reason: {request.reason}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => void handleRejectDeletionRequest(request.id)}
                        >
                          <ShieldX className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={loading}
                          onClick={() => void handleApproveDeletionRequest(request.id)}
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Archived Students</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Admin can restore archived students and bring their active records back.
                </div>
              </div>
              <Badge variant="outline" className="chip-soft-primary px-3 py-1 font-mono text-xs whitespace-nowrap">
                {archivedStudents.length}
              </Badge>
            </div>

            {archivedStudents.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-800">
                No archived students available for restore.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {archivedStudents.map((student) => (
                  <div key={student.id} className="rounded-lg border border-slate-200 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{student.name}</div>
                        <div className="font-mono text-xs text-slate-500">{student.rollNo}</div>
                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          {student.sectionName} · reason: {student.archiveReason}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => void handleRestoreArchivedStudent(student.id)}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Restore
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Table ── */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead>Roll Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="text-right pr-6 text-slate-400 font-normal text-xs">Marks / actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                    {totalCount === 0 ? "No students found. Import a CSV to get started." : "No students match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                initialData.map(s => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors group"
                    onClick={() => router.push(`/dashboard/students/${s.id}`)}
                  >
                    <TableCell className="font-mono text-indigo-600 dark:text-indigo-400 font-medium">{s.rollNo}</TableCell>
                    <TableCell className="font-medium text-slate-700 dark:text-slate-300">
                      <div className="flex flex-col items-start gap-1">
                        <span>{s.name}</span>
                        {s.excludeFromAnalytics ? (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                          >
                            Analytics excluded
                          </Badge>
                        ) : null}
                        {pendingDeletionStudentIds.has(s.id) ? (
                          <Badge
                            variant="secondary"
                            className="bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
                          >
                            Deletion request pending
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {formatCompactSectionLabel(s)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            setEditingStudent({ ...s })
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            setDeletingStudent(s)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Page <span className="font-semibold text-slate-900 dark:text-slate-100">{currentPage}</span> of{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">{pageCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => navigateWithParams({ page: String(currentPage - 1) })}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={currentPage >= pageCount}
            onClick={() => navigateWithParams({ page: String(currentPage + 1) })}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student identity and move the student to a different reusable class when needed.
            </DialogDescription>
          </DialogHeader>
          {editingStudent ? (
            <form onSubmit={handleUpdateStudent}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-student-roll">Roll Number</Label>
                  <Input id="edit-student-roll" name="rollNo" defaultValue={editingStudent.rollNo} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-student-name">Name</Label>
                  <Input id="edit-student-name" name="name" defaultValue={editingStudent.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-student-section">Class / Section</Label>
                  <select
                    id="edit-student-section"
                    name="sectionId"
                    defaultValue={editingStudent.section.id}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <input
                    type="hidden"
                    name="excludeFromAnalytics"
                    value={editingStudent.excludeFromAnalytics ? "on" : "off"}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Analytics</div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        Keep analytics on for this student by default. Turn it off to exclude the student from all analytics and reports globally.
                      </div>
                    </div>
                    <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={!editingStudent.excludeFromAnalytics}
                        onChange={(event) => handleEditAnalyticsIncludedChange(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                      />
                      Include in analytics
                    </label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingStudent(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {loading ? "Saving..." : "Save Student"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingStudent} onOpenChange={(open) => !open && setDeletingStudent(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Archive & Delete Student</DialogTitle>
            <DialogDescription>
              This archives the student snapshot and removes the active student record, marks, and linked enrollments from all class records and analytics.
            </DialogDescription>
          </DialogHeader>
          {deletingStudent ? (
            <>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-950 dark:bg-rose-950/40 dark:text-rose-200">
                <div className="font-semibold">{deletingStudent.name}</div>
                <div className="text-xs opacity-80">{deletingStudent.rollNo}</div>
                <div className="mt-2">Class: {deletingStudent.section.name}</div>
                {deletingStudent.excludeFromAnalytics ? (
                  <div className="mt-1 text-xs opacity-80">Analytics exclusion is currently enabled for this student.</div>
                ) : null}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeletingStudent(null)}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" disabled={loading} onClick={handleDeleteStudent}>
                  {loading ? "Archiving..." : "Archive & Delete"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
