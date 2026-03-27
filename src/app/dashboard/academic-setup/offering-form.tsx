"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getErrorMessage } from "@/lib/client-errors"
import { createCourseOffering, updateCourseOffering } from "./actions"

type SubjectRecord = {
  id: string
  code: string
  title: string
}

type ClassRecord = {
  id: string
  name: string
  program: string | null
  semester: string | null
  year: string | null
  _count: {
    students: number
  }
}

type FacultyRecord = {
  id: string
  user: {
    name: string | null
    email: string | null
  }
}

type MentorRecord = {
  id: string
  name: string | null
  email: string | null
}

type OfferingRecord = {
  id: string
  term: string
  academicYear: string
  semester: string
  year: string
  evaluationPattern: string
  courseType: string
  isElective: boolean
  isActive: boolean
  subject: {
    id: string
  }
  classAssignments: Array<{
    sectionId: string
    facultyId: string | null
    section?: {
      name: string
    }
  }>
  mentorAssignments: Array<{
    userId: string
  }>
}

type OfferingFormState = {
  subjectId: string
  term: string
  academicYear: string
  semester: string
  year: string
  evaluationPattern: string
  courseType: string
  isElective: boolean
  isActive: boolean
  selectedSectionIds: string[]
  facultyBySectionId: Record<string, string>
  mentorIds: string[]
}

function emptyOfferingState(subjects: SubjectRecord[]): OfferingFormState {
  return {
    subjectId: subjects[0]?.id ?? "",
    term: "Even / Winter",
    academicYear: "2025 - 2026",
    semester: "VI",
    year: "III",
    evaluationPattern: "70 - 30",
    courseType: "Theory",
    isElective: false,
    isActive: true,
    selectedSectionIds: [],
    facultyBySectionId: {},
    mentorIds: [],
  }
}

function offeringToState(offering: OfferingRecord): OfferingFormState {
  return {
    subjectId: offering.subject.id,
    term: offering.term,
    academicYear: offering.academicYear,
    semester: offering.semester,
    year: offering.year,
    evaluationPattern: offering.evaluationPattern,
    courseType: offering.courseType,
    isElective: offering.isElective,
    isActive: offering.isActive,
    selectedSectionIds: offering.classAssignments.map((assignment) => assignment.sectionId),
    facultyBySectionId: Object.fromEntries(
      offering.classAssignments.map((assignment) => [assignment.sectionId, assignment.facultyId ?? ""])
    ),
    mentorIds: offering.mentorAssignments.map((assignment) => assignment.userId),
  }
}

export function OfferingFormPage({
  mode,
  subjects,
  classes,
  facultyMembers,
  mentors,
  offering,
}: {
  mode: "create" | "edit"
  subjects: SubjectRecord[]
  classes: ClassRecord[]
  facultyMembers: FacultyRecord[]
  mentors: MentorRecord[]
  offering?: OfferingRecord
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [state, setState] = useState<OfferingFormState>(() =>
    offering ? offeringToState(offering) : emptyOfferingState(subjects)
  )
  const selectedSections = new Set(state.selectedSectionIds)
  const selectedSubject = subjects.find((subject) => subject.id === state.subjectId)
  const selectedSubjectLabel = selectedSubject
    ? `${selectedSubject.code} · ${selectedSubject.title}`
    : "Select a subject"

  const getFacultyLabel = (facultyId: string) => {
    if (!facultyId || facultyId === "unassigned") {
      return "Unassigned"
    }

    const faculty = facultyMembers.find((member) => member.id === facultyId)
    return faculty?.user.name ?? faculty?.user.email ?? "Assigned faculty"
  }

  const toggleSection = (sectionId: string, checked: boolean) => {
    const nextSelected = checked
      ? [...state.selectedSectionIds, sectionId]
      : state.selectedSectionIds.filter((id) => id !== sectionId)

    const nextFacultyBySectionId = { ...state.facultyBySectionId }
    if (!checked) {
      delete nextFacultyBySectionId[sectionId]
    }

    setState({
      ...state,
      selectedSectionIds: nextSelected,
      facultyBySectionId: nextFacultyBySectionId,
    })
  }

  const toggleMentor = (userId: string, checked: boolean) => {
    setState({
      ...state,
      mentorIds: state.isElective
        ? checked
          ? [userId]
          : []
        : checked
          ? [...state.mentorIds, userId]
          : state.mentorIds.filter((id) => id !== userId),
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...state,
        classAssignments: state.isElective
          ? []
          : state.selectedSectionIds.map((sectionId) => ({
              sectionId,
              facultyId: state.facultyBySectionId[sectionId] || null,
            })),
      }

      if (mode === "create") {
        await createCourseOffering(payload)
        toast.success("Course offering created")
      } else if (offering) {
        await updateCourseOffering(offering.id, payload)
        toast.success("Course offering updated")
      }

      router.push("/dashboard/academic-setup")
      router.refresh()
    } catch (error) {
      toast.error(getErrorMessage(error, `Failed to ${mode} course offering`))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {mode === "create" ? "Create Course Offering" : "Edit Course Offering"}
          </h1>
          <p className="text-slate-500">
            {mode === "create"
              ? "Set the academic context and allocate classes, faculty, and mentors on a dedicated setup screen."
              : "Update the academic context, allocations, and visibility for this course offering without fighting a cramped popup."}
          </p>
        </div>
        <Button variant="outline" render={<Link href="/dashboard/academic-setup" />}>
          Back to Academic Setup
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Offering Details</CardTitle>
              <CardDescription>Choose the subject and fill in the academic context for this iteration.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Subject</Label>
                <Select
                  value={state.subjectId}
                  onValueChange={(value) => setState({ ...state, subjectId: value ?? "" })}
                >
                  <SelectTrigger>
                    {state.subjectId ? selectedSubjectLabel : <SelectValue placeholder="Select a subject" />}
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.code} · {subject.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="offering-term">Term</Label>
                <Input id="offering-term" value={state.term} onChange={(event) => setState({ ...state, term: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offering-academic-year">Academic Year</Label>
                <Input id="offering-academic-year" value={state.academicYear} onChange={(event) => setState({ ...state, academicYear: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offering-semester">Semester</Label>
                <Input id="offering-semester" value={state.semester} onChange={(event) => setState({ ...state, semester: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offering-year">Year</Label>
                <Input id="offering-year" value={state.year} onChange={(event) => setState({ ...state, year: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offering-pattern">Evaluation Pattern</Label>
                <Input id="offering-pattern" value={state.evaluationPattern} onChange={(event) => setState({ ...state, evaluationPattern: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offering-course-type">Course Type</Label>
                <Input id="offering-course-type" value={state.courseType} onChange={(event) => setState({ ...state, courseType: event.target.value })} />
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm md:col-span-2 dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={state.isElective}
                  onChange={(event) => setState({ ...state, isElective: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>
                  Mark this as an elective offering. Electives use one dedicated class, do not use reusable sections, and treat the selected mentor as the default faculty.
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visibility & Mentors</CardTitle>
              <CardDescription>Keep the offering active only when it should appear in mentor and faculty workspace selection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {state.isElective ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  Elective offering mode is enabled. Choose exactly one mentor here; that faculty member will automatically become the teaching owner for the elective class as well.
                </div>
              ) : null}
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={state.isActive}
                  onChange={(event) => setState({ ...state, isActive: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>Expose this offering in the workspace selector for mentors and faculty</span>
              </label>

              <div className="grid gap-2">
                {mentors.map((mentor) => {
                  const checked = state.mentorIds.includes(mentor.id)
                  return (
                    <label key={mentor.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                      <input
                        type={state.isElective ? "radio" : "checkbox"}
                        checked={checked}
                        onChange={(event) => toggleMentor(mentor.id, event.target.checked)}
                        name={state.isElective ? "elective-mentor" : undefined}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>{mentor.name ?? mentor.email ?? "Mentor"}</span>
                    </label>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {state.isElective ? (
          <Card>
            <CardHeader>
              <CardTitle>Elective Roster Flow</CardTitle>
              <CardDescription>Elective offerings use one dedicated class that is created automatically for the offering.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                Create the offering first, then ask the teaching owner to open the elective workspace and upload a roster CSV from <span className="font-medium">Section Allocation</span> using only <span className="font-medium">rollNo</span>. Students from any home class can join the elective, and missing registry entries will be flagged for admin follow-up instead of being created silently.
              </div>
              {offering?.classAssignments.length ? (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Current Elective Class</Label>
                  <div className="flex flex-wrap gap-2">
                    {offering.classAssignments.map((assignment) => (
                      <Badge key={assignment.sectionId} variant="outline">
                        {assignment.section?.name ?? "Elective class"}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Classes in this Offering</CardTitle>
                <CardDescription>Reuse class rosters here, then choose the faculty assignment for this offering only.</CardDescription>
              </div>
              <Badge variant="outline">{state.selectedSectionIds.length} selected</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {classes.map((section) => {
                const checked = selectedSections.has(section.id)
                return (
                  <div key={section.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                    <label className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => toggleSection(section.id, event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                        />
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">{section.name}</div>
                          <div className="text-xs text-slate-500">
                            {section.program ?? "Academic program label pending"} · {section.semester ?? "Semester pending"} · Year {section.year ?? "—"}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{section._count.students} students</Badge>
                    </label>

                    {checked ? (
                      <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                        <Label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Assigned Faculty</Label>
                        <Select
                          value={state.facultyBySectionId[section.id] ?? "unassigned"}
                          onValueChange={(value) =>
                            setState({
                              ...state,
                              facultyBySectionId: {
                                ...state.facultyBySectionId,
                                [section.id]: !value || value === "unassigned" ? "" : value,
                              },
                            })
                          }
                        >
                          <SelectTrigger>
                            {getFacultyLabel(state.facultyBySectionId[section.id] ?? "unassigned")}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {facultyMembers.map((faculty) => (
                              <SelectItem key={faculty.id} value={faculty.id}>
                                {faculty.user.name ?? faculty.user.email ?? "Faculty"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 rounded-xl border border-slate-200 bg-background/95 px-5 py-4 backdrop-blur dark:border-slate-800">
        <Button variant="outline" render={<Link href="/dashboard/academic-setup" />}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          {saving ? "Saving..." : mode === "create" ? "Create Offering" : "Save Offering"}
        </Button>
      </div>
    </div>
  )
}
