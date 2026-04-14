"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronRight, Search, Sigma, Users } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getErrorMessage } from "@/lib/client-errors"
import type { WorkspaceRoleView } from "@/lib/course-workspace"
import type { AssessmentFamily, CASubcomponent } from "@/lib/assessment-structure"
import { setStudentAnalyticsExclusion } from "./actions"

type Section = {
  id: string
  name: string
  semester: string | null
  programCode: string | null
  sectionCode: string | null
}

type Student = {
  id: string
  rollNo: string
  name: string
  excludeFromAnalytics: boolean
  section: Section
  marks: Array<{
    assessmentId: string
    marks: number
  }>
}

type Assessment = {
  id: string
  name: string
  code: string
  maxMarks: number
  category: string
  classification: {
    family: AssessmentFamily
    familyLabel: string
    subcomponent: CASubcomponent
    subcomponentLabel: string | null
    analyticsFilterKey: string
  }
}

function formatCompactSectionLabel(section: Section) {
  const semester = section.semester?.trim() || null
  const programCode = section.programCode?.trim().toUpperCase() || null
  const sectionCode = section.sectionCode?.trim().toUpperCase() || null

  if (semester && programCode && sectionCode) {
    return `${semester} ${programCode} ${sectionCode}`
  }

  return section.name
}

export function WorkspaceStudentsClient({
  initialData,
  sections,
  assessments,
  roleView,
  searchQuery,
  currentPage,
  pageCount,
  totalCount,
  selectedSectionId,
  pendingDeletionStudentIds,
}: {
  initialData: Student[]
  sections: Section[]
  assessments: Assessment[]
  roleView: WorkspaceRoleView
  searchQuery: string
  currentPage: number
  pageCount: number
  totalCount: number
  selectedSectionId: string
  pendingDeletionStudentIds: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [students, setStudents] = useState(initialData)
  const [search, setSearch] = useState(searchQuery)
  const deferredSearch = useDeferredValue(search)
  const [assessmentFilter, setAssessmentFilter] = useState("ALL")
  const [updatingStudentIds, setUpdatingStudentIds] = useState<Set<string>>(new Set())
  const pendingDeletionSet = useMemo(() => new Set(pendingDeletionStudentIds), [pendingDeletionStudentIds])

  useEffect(() => {
    setStudents(initialData)
  }, [initialData])

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

  const sectionOptions = useMemo(
    () =>
      sections.map((section) => ({
        id: section.id,
        label: formatCompactSectionLabel(section),
        longLabel: section.name,
      })),
    [sections]
  )

  const assessmentOptions = useMemo(
    () =>
      assessments.map((assessment) => ({
        id: assessment.id,
        label: assessment.name,
        helper:
          assessment.classification.subcomponentLabel ??
          assessment.classification.familyLabel,
        maxMarks: assessment.maxMarks,
      })),
    [assessments]
  )

  const filteredStudents = students

  const selectedAssessment =
    assessmentFilter === "ALL"
      ? null
      : assessments.find((assessment) => assessment.id === assessmentFilter) ?? null

  const filteredStudentRows = useMemo(
    () =>
      filteredStudents.map((student) => ({
        ...student,
        selectedMark:
          selectedAssessment
            ? student.marks.find((mark) => mark.assessmentId === selectedAssessment.id)?.marks ?? null
            : null,
      })),
    [filteredStudents, selectedAssessment]
  )

  const selectedAssessmentValues = useMemo(() => {
    if (!selectedAssessment) return []

    return filteredStudentRows
      .map((student) => student.selectedMark)
      .filter((mark): mark is number => typeof mark === "number")
      .sort((left, right) => left - right)
  }, [filteredStudentRows, selectedAssessment])

  const summaryStats = useMemo(() => {
    if (!selectedAssessment) return null

    const values = selectedAssessmentValues
    const totalStudents = filteredStudentRows.length
    const entered = values.length

    if (entered === 0) {
      return {
        mean: 0,
        median: 0,
        highest: 0,
        completionRate: totalStudents > 0 ? 0 : 0,
      }
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / entered
    const middle = Math.floor(entered / 2)
    const median =
      entered % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle]

    return {
      mean,
      median,
      highest: values[entered - 1],
      completionRate: totalStudents > 0 ? (entered / totalStudents) * 100 : 0,
    }
  }, [filteredStudentRows.length, selectedAssessment, selectedAssessmentValues])

  const handleSetAnalyticsEnabled = async (studentId: string, enabled: boolean) => {
    if (!enabled) {
      const confirmed = window.confirm(
        "Exclude this student from analytics? The student will be removed from analytics and report calculations globally."
      )
      if (!confirmed) return
    }

    const previousStudents = students
    setStudents((current) =>
      current.map((student) =>
        student.id === studentId ? { ...student, excludeFromAnalytics: !enabled } : student
      )
    )
    setUpdatingStudentIds((current) => new Set(current).add(studentId))

    try {
      await setStudentAnalyticsExclusion(studentId, !enabled)
      toast.success(enabled ? "Student included in analytics" : "Student excluded from analytics")
      router.refresh()
    } catch (error) {
      setStudents(previousStudents)
      toast.error(getErrorMessage(error, "Failed to update analytics exclusion"))
    } finally {
      setUpdatingStudentIds((current) => {
        const next = new Set(current)
        next.delete(studentId)
        return next
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="mb-3">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Student Search</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Search the current subject roster by roll number or name.
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by roll number or student name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 pl-9 text-sm"
            />
          </div>

          {roleView === "mentor" && sectionOptions.length > 1 ? (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Filter by section
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigateWithParams({ section: null, page: null })}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedSectionId === "ALL"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                  }`}
                >
                  All Sections
                </button>
                {sectionOptions.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => navigateWithParams({ section: section.id, page: null })}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selectedSectionId === section.id
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                    }`}
                    title={section.longLabel}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {assessmentOptions.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Component focus
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAssessmentFilter("ALL")}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    assessmentFilter === "ALL"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                  }`}
                >
                  No component focus
                </button>
                {assessmentOptions.map((assessment) => (
                  <button
                    key={assessment.id}
                    type="button"
                    onClick={() => setAssessmentFilter(assessment.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      assessmentFilter === assessment.id
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                    }`}
                    title={`${assessment.label} · ${assessment.helper} · ${assessment.maxMarks} max`}
                  >
                    {assessment.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {selectedAssessment && summaryStats ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Sigma}
            label="Mean"
            value={summaryStats.mean.toFixed(1)}
            helper={`Out of ${selectedAssessment.maxMarks}`}
          />
          <SummaryCard
            icon={Sigma}
            label="Median"
            value={summaryStats.median.toFixed(1)}
            helper={`For ${selectedAssessment.name}`}
          />
          <SummaryCard
            icon={Users}
            label="Completion"
            value={`${summaryStats.completionRate.toFixed(0)}%`}
            helper={`${selectedAssessmentValues.length} recorded`}
          />
          <SummaryCard
            icon={ChevronRight}
            label="Highest"
            value={summaryStats.highest.toFixed(1)}
            helper={selectedAssessment.code}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline" className="chip-soft-primary px-3 py-1 font-mono text-xs whitespace-nowrap">
          {initialData.length} shown
        </Badge>
        <div className="text-xs text-slate-500">
          {totalCount.toLocaleString()} total students in this result set
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <ScrollArea className="h-[calc(100vh-300px)]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-sm dark:bg-slate-900/50">
                <TableRow>
                  <TableHead>Roll Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Section</TableHead>
                  {roleView === "mentor" ? <TableHead>Analytics</TableHead> : null}
                  {selectedAssessment ? (
                    <TableHead>
                    <div className="flex flex-col">
                      <span>{selectedAssessment.name}</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        {selectedAssessment.maxMarks} max
                      </span>
                    </div>
                  </TableHead>
                ) : null}
                <TableHead className="pr-6 text-right text-xs font-normal text-slate-400">Open record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudentRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={selectedAssessment ? (roleView === "mentor" ? 6 : 5) : roleView === "mentor" ? 5 : 4} className="h-24 text-center text-slate-500">
                    {totalCount === 0 ? "No students are available in this scope yet." : "No students match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudentRows.map((student) => (
                  <TableRow
                    key={student.id}
                    className="group cursor-pointer transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10"
                    onClick={() => router.push(`/dashboard/students/${student.id}`)}
                  >
                    <TableCell className="font-mono font-medium text-indigo-600 dark:text-indigo-400">
                      {student.rollNo}
                    </TableCell>
                    <TableCell className="font-medium text-slate-700 dark:text-slate-300">
                      <div className="flex flex-col items-start gap-1">
                        <span>{student.name}</span>
                        {student.excludeFromAnalytics ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                            Analytics excluded
                          </Badge>
                        ) : null}
                        {pendingDeletionSet.has(student.id) ? (
                          <Badge variant="secondary" className="bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200">
                            Deletion request pending
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="chip-soft-neutral">
                        {formatCompactSectionLabel(student.section)}
                      </Badge>
                    </TableCell>
                    {roleView === "mentor" ? (
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <label className="flex items-center gap-3 text-xs font-medium text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={!student.excludeFromAnalytics}
                            disabled={updatingStudentIds.has(student.id)}
                            onChange={(event) => void handleSetAnalyticsEnabled(student.id, event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                          />
                          Include
                        </label>
                      </TableCell>
                    ) : null}
                    {selectedAssessment ? (
                      <TableCell className="font-mono text-slate-700 dark:text-slate-300">
                        {student.selectedMark !== null ? student.selectedMark.toFixed(1) : "—"}
                      </TableCell>
                    ) : null}
                    <TableCell className="pr-4 text-right">
                      <ChevronRight className="inline h-4 w-4 text-slate-300 transition-colors group-hover:text-indigo-400" />
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
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  )
}
