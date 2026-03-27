"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import type { WorkspaceRoleView } from "@/lib/course-workspace"

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
  section: Section
}

function normalizeSearchValue(value: string) {
  return value.toLowerCase().replace(/\s+/g, "")
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
  roleView,
}: {
  initialData: Student[]
  sections: Section[]
  roleView: WorkspaceRoleView
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [sectionFilter, setSectionFilter] = useState("ALL")

  const sectionOptions = useMemo(
    () =>
      sections.map((section) => ({
        id: section.id,
        label: formatCompactSectionLabel(section),
        longLabel: section.name,
      })),
    [sections]
  )

  const filteredStudents = useMemo(() => {
    const query = normalizeSearchValue(deferredSearch.trim())
    return initialData.filter((student) => {
      const matchesSearch =
        !query ||
        normalizeSearchValue(student.rollNo).includes(query) ||
        normalizeSearchValue(student.name).includes(query) ||
        normalizeSearchValue(student.section.name).includes(query) ||
        normalizeSearchValue(formatCompactSectionLabel(student.section)).includes(query)

      const matchesSection = roleView !== "mentor" || sectionFilter === "ALL" || student.section.id === sectionFilter

      return matchesSearch && matchesSection
    })
  }, [deferredSearch, initialData, roleView, sectionFilter])

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
                  onClick={() => setSectionFilter("ALL")}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    sectionFilter === "ALL"
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
                    onClick={() => setSectionFilter(section.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      sectionFilter === section.id
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
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline" className="bg-indigo-50 px-3 py-1 font-mono text-xs text-indigo-700 border-indigo-200 whitespace-nowrap">
          {filteredStudents.length} / {initialData.length}
        </Badge>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <ScrollArea className="h-[calc(100vh-300px)]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-sm dark:bg-slate-900/50">
              <TableRow>
                <TableHead>Roll Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="pr-6 text-right text-xs font-normal text-slate-400">Open record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                    {initialData.length === 0 ? "No students are available in this scope yet." : "No students match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow
                    key={student.id}
                    className="group cursor-pointer transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10"
                    onClick={() => router.push(`/dashboard/students/${student.id}`)}
                  >
                    <TableCell className="font-mono font-medium text-indigo-600 dark:text-indigo-400">
                      {student.rollNo}
                    </TableCell>
                    <TableCell className="font-medium text-slate-700 dark:text-slate-300">
                      {student.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {formatCompactSectionLabel(student.section)}
                      </Badge>
                    </TableCell>
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
    </div>
  )
}
