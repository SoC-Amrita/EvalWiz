"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { BookCopy, CalendarRange, Layers3, Pencil, Plus, Trash2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getErrorMessage } from "@/lib/client-errors"
import { formatRollSignature, inferSectionCodeFromLabel } from "@/lib/roll-number"

import {
  createClass,
  createSubject,
  deleteClass,
  deleteCourseOffering,
  deleteSubject,
  updateClass,
  updateSubject,
} from "./actions"

type SubjectRecord = {
  id: string
  code: string
  title: string
  program: string
  isActive: boolean
  _count: {
    offerings: number
  }
}

type ClassRecord = {
  id: string
  name: string
  program: string | null
  term: string | null
  academicYear: string | null
  semester: string | null
  year: string | null
  rollPrefix: string | null
  schoolCode: string | null
  levelCode: string | null
  programDurationYears: number | null
  programCode: string | null
  admissionYear: string | null
  expectedGraduationYear: string | null
  sectionCode: string | null
  isActive: boolean
  _count: {
    students: number
    offeringAssignments: number
  }
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
    code: string
    title: string
    program: string
  }
  classAssignments: Array<{
    id: string
    sectionId: string
    facultyId: string | null
    section: {
      id: string
      name: string
    }
    faculty: {
      id: string
      user: {
        name: string | null
      }
    } | null
  }>
  mentorAssignments: Array<{
    id: string
    userId: string
    user: {
      id: string
      name: string | null
      email: string | null
    }
  }>
}

type ClassFormState = {
  program: string
  term: string
  academicYear: string
  batchYear: string
  sectionCode: string
  isActive: boolean
}

type SubjectFormState = {
  code: string
  title: string
  program: string
  isActive: boolean
}

function classToState(section: ClassRecord): ClassFormState {
  return {
    program: section.program ?? "",
    term: section.term ?? "Even / Winter",
    academicYear: section.academicYear ?? "",
    batchYear: section.admissionYear ?? "",
    sectionCode: section.sectionCode ?? inferSectionCodeFromLabel(section.name) ?? "",
    isActive: section.isActive,
  }
}

export function AcademicSetupClient({
  subjects,
  classes,
  offerings,
}: {
  subjects: SubjectRecord[]
  classes: ClassRecord[]
  offerings: OfferingRecord[]
}) {
  const router = useRouter()
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false)
  const [classDialogOpen, setClassDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<SubjectRecord | null>(null)
  const [editingClass, setEditingClass] = useState<ClassRecord | null>(null)
  const [saving, setSaving] = useState(false)

  const [subjectForm, setSubjectForm] = useState<SubjectFormState>({
    code: "",
    title: "",
    program: "",
    isActive: true,
  })
  const [classForm, setClassForm] = useState<ClassFormState>({
    program: "",
    term: "Even / Winter",
    academicYear: "",
    batchYear: "",
    sectionCode: "",
    isActive: true,
  })

  const resetSubjectForm = () => {
    setSubjectForm({
      code: "",
      title: "",
      program: "",
      isActive: true,
    })
  }

  const resetClassForm = () => {
    setClassForm({
      program: "",
      term: "Even / Winter",
      academicYear: "",
      batchYear: "",
      sectionCode: "",
      isActive: true,
    })
  }

  const handleCreateSubject = async () => {
    setSaving(true)
    try {
      await createSubject(subjectForm)
      toast.success("Subject created")
      setSubjectDialogOpen(false)
      resetSubjectForm()
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create subject"))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateSubject = async () => {
    if (!editingSubject) return

    setSaving(true)
    try {
      await updateSubject(editingSubject.id, subjectForm)
      toast.success("Subject updated")
      setEditingSubject(null)
      resetSubjectForm()
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update subject"))
    } finally {
      setSaving(false)
    }
  }

  const handleCreateClass = async () => {
    setSaving(true)
    try {
      const result = await createClass(classForm)
      router.refresh()
      toast.success(`Class saved and ${result.syncedCount} matching student${result.syncedCount === 1 ? "" : "s"} synchronized`)
      setClassDialogOpen(false)
      resetClassForm()
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create class"))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateClass = async () => {
    if (!editingClass) return

    setSaving(true)
    try {
      await updateClass(editingClass.id, classForm)
      router.refresh()
      toast.success("Class updated")
      setEditingClass(null)
      resetClassForm()
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update class"))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSubject = async (subject: SubjectRecord) => {
    if (!confirm(`Delete subject ${subject.code}? This is only allowed when it has no course offerings.`)) return

    setSaving(true)
    try {
      await deleteSubject(subject.id)
      toast.success("Subject deleted")
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete subject"))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClass = async (section: ClassRecord) => {
    if (!confirm(`Delete class ${section.name}? This is only allowed when it has no students and no offering assignments.`)) return

    setSaving(true)
    try {
      await deleteClass(section.id)
      toast.success("Class deleted")
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete class"))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteOffering = async (offering: OfferingRecord) => {
    if (!confirm(`Delete offering ${offering.subject.code} ${offering.term} ${offering.academicYear}? This is only allowed when no assessments exist yet.`)) return

    setSaving(true)
    try {
      await deleteCourseOffering(offering.id)
      toast.success("Course offering deleted")
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete course offering"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Tabs defaultValue="subjects" className="space-y-6">
      <TabsList>
        <TabsTrigger value="subjects">Subjects</TabsTrigger>
        <TabsTrigger value="classes">Classes</TabsTrigger>
        <TabsTrigger value="offerings">Course Offerings</TabsTrigger>
      </TabsList>

      <TabsContent value="subjects">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookCopy className="h-5 w-5 text-indigo-600" />
                Subject Catalog
              </CardTitle>
              <CardDescription>Create reusable subjects that can run across multiple terms and academic years. Subjects are not classified using roll-number school or program codes.</CardDescription>
            </div>
            <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
              <DialogTrigger render={<Button className="bg-indigo-600 hover:bg-indigo-700 text-white" />}>
                <Plus className="mr-2 h-4 w-4" />
                Add Subject
              </DialogTrigger>
              <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle>Create Subject</DialogTitle>
                  <DialogDescription>Add a reusable subject definition for future offerings.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject-code">Subject Code</Label>
                      <Input
                        id="subject-code"
                        value={subjectForm.code}
                        onChange={(event) => setSubjectForm({ ...subjectForm, code: event.target.value })}
                      />
                    </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject-title">Subject Title</Label>
                    <Input
                      id="subject-title"
                      value={subjectForm.title}
                      onChange={(event) => setSubjectForm({ ...subjectForm, title: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject-program">Subject Program / Degree Track</Label>
                    <Input
                      id="subject-program"
                      value={subjectForm.program}
                      onChange={(event) => setSubjectForm({ ...subjectForm, program: event.target.value })}
                    />
                  </div>
                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                    <input
                      type="checkbox"
                      checked={subjectForm.isActive}
                      onChange={(event) => setSubjectForm({ ...subjectForm, isActive: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span>Mark this subject as available for new offerings</span>
                  </label>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateSubject} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {saving ? "Creating..." : "Create Subject"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Subject Program</TableHead>
                  <TableHead>Offerings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell>
                      <div className="font-medium">{subject.code}</div>
                      <div className="text-sm text-slate-500">{subject.title}</div>
                    </TableCell>
                    <TableCell>{subject.program}</TableCell>
                    <TableCell>{subject._count.offerings}</TableCell>
                    <TableCell>
                      <Badge variant={subject.isActive ? "default" : "secondary"}>
                        {subject.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingSubject(subject)
                            setSubjectForm({
                              code: subject.code,
                              title: subject.title,
                              program: subject.program,
                              isActive: subject.isActive,
                            })
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSubject(subject)}
                          disabled={saving}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!editingSubject} onOpenChange={(open) => !open && setEditingSubject(null)}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Edit Subject</DialogTitle>
              <DialogDescription>Update the reusable subject definition and its availability for future offerings.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-subject-code">Subject Code</Label>
                <Input
                  id="edit-subject-code"
                  value={subjectForm.code}
                  onChange={(event) => setSubjectForm({ ...subjectForm, code: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-subject-title">Subject Title</Label>
                <Input
                  id="edit-subject-title"
                  value={subjectForm.title}
                  onChange={(event) => setSubjectForm({ ...subjectForm, title: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-subject-program">Subject Program / Degree Track</Label>
                <Input
                  id="edit-subject-program"
                  value={subjectForm.program}
                  onChange={(event) => setSubjectForm({ ...subjectForm, program: event.target.value })}
                />
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={subjectForm.isActive}
                  onChange={(event) => setSubjectForm({ ...subjectForm, isActive: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>Mark this subject as available for new offerings</span>
              </label>
            </div>
            <DialogFooter>
              <Button onClick={handleUpdateSubject} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {saving ? "Saving..." : "Save Subject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabsContent>

      <TabsContent value="classes">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers3 className="h-5 w-5 text-rose-600" />
                Reusable Class Catalog
              </CardTitle>
              <CardDescription>
                Manage class rosters independently from subjects so the same class can be reused across offerings. The roll-number fields below are only for grouping students into reusable classes.
              </CardDescription>
            </div>
            <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
              <DialogTrigger render={<Button className="bg-rose-600 hover:bg-rose-700 text-white" />}>
                <Plus className="mr-2 h-4 w-4" />
                Create Class
              </DialogTrigger>
              <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle>Create Class</DialogTitle>
                  <DialogDescription>
                    Create one reusable class by academic context and section. If matching students already exist in the centralized student list, they will be synchronized automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                    Class creation is separate from the centralized student list. Enter the class context and section here. The system will attach any already-uploaded students whose roll numbers match this class signature.
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="class-program">Academic Program Label</Label>
                    <Input
                      id="class-program"
                      value={classForm.program}
                      onChange={(event) => setClassForm({ ...classForm, program: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="class-term">Term</Label>
                      <select
                        id="class-term"
                        value={classForm.term}
                        onChange={(event) => setClassForm({ ...classForm, term: event.target.value })}
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="Odd / Monsoon">Odd / Monsoon</option>
                        <option value="Even / Winter">Even / Winter</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="class-academic-year">Academic Year</Label>
                      <Input
                        id="class-academic-year"
                        value={classForm.academicYear}
                        onChange={(event) => setClassForm({ ...classForm, academicYear: event.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="class-batch-year">Batch Year</Label>
                    <Input
                      id="class-batch-year"
                      value={classForm.batchYear}
                      onChange={(event) => setClassForm({ ...classForm, batchYear: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="class-section-code">Section</Label>
                    <Input
                      id="class-section-code"
                      value={classForm.sectionCode}
                      onChange={(event) => setClassForm({ ...classForm, sectionCode: event.target.value.toUpperCase() })}
                      placeholder="A"
                    />
                  </div>
                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                    <input
                      type="checkbox"
                      checked={classForm.isActive}
                      onChange={(event) => setClassForm({ ...classForm, isActive: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span>Keep this class available for new offerings</span>
                  </label>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateClass} disabled={saving} className="bg-rose-600 hover:bg-rose-700 text-white">
                    {saving ? "Saving..." : "Create Class"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Academic Placement</TableHead>
                  <TableHead>Roll Signature</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Offerings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((section) => (
                  <TableRow key={section.id}>
                    <TableCell>
                      <div className="font-medium">{section.name}</div>
                      <div className="text-sm text-slate-500">{section.program ?? "Academic program label pending"}</div>
                    </TableCell>
                    <TableCell>
                      {section.term ?? "Term pending"} · {section.academicYear ?? "Academic year pending"} · Year {section.year ?? "—"} · Semester {section.semester ?? "—"}
                    </TableCell>
                    <TableCell>
                      {section.rollPrefix &&
                      section.schoolCode &&
                      section.levelCode &&
                      section.programDurationYears !== null &&
                      section.programCode &&
                      section.admissionYear &&
                      section.sectionCode ? (
                        <div className="text-sm font-medium">
                          {formatRollSignature({
                            rollPrefix: section.rollPrefix,
                            schoolCode: section.schoolCode,
                            levelCode: section.levelCode,
                            programDurationYears: section.programDurationYears,
                            programCode: section.programCode,
                            admissionYear: section.admissionYear,
                            sectionCode: section.sectionCode,
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400">—</div>
                      )}
                    </TableCell>
                    <TableCell>{section.admissionYear ?? "—"}</TableCell>
                    <TableCell>{section._count.students}</TableCell>
                    <TableCell>{section._count.offeringAssignments}</TableCell>
                    <TableCell>
                      <Badge variant={section.isActive ? "default" : "secondary"}>
                        {section.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingClass(section)
                            setClassForm(classToState(section))
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClass(section)}
                          disabled={saving}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!editingClass} onOpenChange={(open) => !open && setEditingClass(null)}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Edit Class</DialogTitle>
              <DialogDescription>Advance the selected class for the next academic cycle without changing its lifetime student identity grouping.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                The class keeps its roll-derived identity such as CSE D for the 2023 batch. You can adjust the academic placement here and repair the section code if needed.
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-class-program">Academic Program Label</Label>
                <Input
                  id="edit-class-program"
                  value={classForm.program}
                  onChange={(event) => setClassForm({ ...classForm, program: event.target.value })}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-class-term">Term</Label>
                  <select
                    id="edit-class-term"
                    value={classForm.term}
                    onChange={(event) => setClassForm({ ...classForm, term: event.target.value })}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="Odd / Monsoon">Odd / Monsoon</option>
                    <option value="Even / Winter">Even / Winter</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-class-academic-year">Academic Year</Label>
                  <Input
                    id="edit-class-academic-year"
                    value={classForm.academicYear}
                    onChange={(event) => setClassForm({ ...classForm, academicYear: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-class-batch-year">Batch Year</Label>
                <Input
                  id="edit-class-batch-year"
                  value={classForm.batchYear}
                  onChange={(event) => setClassForm({ ...classForm, batchYear: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-class-section-code">Section</Label>
                <Input
                  id="edit-class-section-code"
                  value={classForm.sectionCode}
                  onChange={(event) => setClassForm({ ...classForm, sectionCode: event.target.value.toUpperCase() })}
                />
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={classForm.isActive}
                  onChange={(event) => setClassForm({ ...classForm, isActive: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>Keep this class available for new offerings</span>
              </label>
            </div>
            <DialogFooter>
              <Button onClick={handleUpdateClass} disabled={saving} className="bg-rose-600 hover:bg-rose-700 text-white">
                {saving ? "Saving..." : "Save Class"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabsContent>

      <TabsContent value="offerings">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarRange className="h-5 w-5 text-emerald-600" />
                Course Offerings
              </CardTitle>
              <CardDescription>
                Publish term-specific subject iterations, attach reusable classes, and control which offerings are active in workspace selection.
              </CardDescription>
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" render={<Link href="/dashboard/academic-setup/offerings/new" />}>
              <Plus className="mr-2 h-4 w-4" />
              Add Offering
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {offerings.map((offering) => (
              <div key={offering.id} className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{offering.subject.code}</Badge>
                      {offering.isElective ? <Badge variant="secondary">Elective</Badge> : null}
                      <Badge variant={offering.isActive ? "default" : "secondary"}>
                        {offering.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {offering.subject.title}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {offering.subject.program} · {offering.term} · {offering.academicYear}
                    </p>
                    <p className="text-sm text-slate-500">
                      {offering.semester} Semester · Year {offering.year} · {offering.courseType} · {offering.evaluationPattern}{offering.isElective ? " · Manual elective roster" : ""}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/dashboard/academic-setup/offerings/${offering.id}`} />}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Offering
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteOffering(offering)}
                      disabled={saving}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900/60">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Classes</div>
                    <div className="mt-2 space-y-2 text-sm">
                      {offering.classAssignments.map((assignment) => (
                        <div key={assignment.id} className="flex items-center justify-between gap-3">
                          <span>{assignment.section.name}</span>
                          <span className="text-slate-500">
                            {assignment.faculty?.user.name ?? "Unassigned"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900/60">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mentors</div>
                    <div className="mt-2 space-y-2 text-sm">
                      {offering.mentorAssignments.length === 0 ? (
                        <div className="text-slate-500">No mentors allocated yet.</div>
                      ) : (
                        offering.mentorAssignments.map((assignment) => (
                          <div key={assignment.id}>{assignment.user.name ?? assignment.user.email ?? "Mentor"}</div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
