"use client"

import { useState } from "react"
import Papa from "papaparse"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { BookOpen, Download, Upload } from "lucide-react"
import { assignFacultyToSection, uploadElectiveRoster } from "./actions"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getErrorMessage } from "@/lib/client-errors"

type User = { id: string, name: string | null, email: string | null }
type FacultyMember = { id: string, user: User, _count: { offeringAssignments: number } }
type SectionWithFaculty = {
  id: string
  name: string
  compactName: string
  facultyId: string | null
  _count: { students: number }
}
type ElectiveRosterCsvRow = { rollNo?: unknown }

export function SectionsClient({ 
  sections,
  facultyMembers,
  canManageUsers,
  workspaceLabel,
  isElective,
}: { 
  sections: SectionWithFaculty[],
  facultyMembers: FacultyMember[],
  canManageUsers: boolean
  workspaceLabel: string
  isElective: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [electiveRosterOpen, setElectiveRosterOpen] = useState(false)
  const [parsedRollNumbers, setParsedRollNumbers] = useState<string[]>([])
  const [rosterErrors, setRosterErrors] = useState<string[]>([])

  const handleAssign = async (sectionId: string, facultyId: string) => {
    setAssigningId(sectionId)
    try {
      await assignFacultyToSection(sectionId, facultyId === "unassigned" ? null : facultyId)
      toast.success("Section assignment updated")
    } catch {
      toast.error("Failed to update section assignment")
    } finally {
      setAssigningId(null)
    }
  }

  const processElectiveRosterFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: string[] = []
        const nextErrors: string[] = []

        results.data.forEach((row, index) => {
          const parsedRow = row as ElectiveRosterCsvRow
          if (!parsedRow.rollNo) {
            nextErrors.push(`Row ${index + 1}: Missing rollNo`)
            return
          }

          rows.push(String(parsedRow.rollNo).trim())
        })

        setParsedRollNumbers(rows)
        setRosterErrors(nextErrors)
      },
      error: (error) => setRosterErrors([error.message]),
    })
  }

  const handleElectiveRosterUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      processElectiveRosterFile(file)
    }
  }

  const handleSubmitElectiveRoster = async () => {
    if (parsedRollNumbers.length === 0) {
      toast.error("Upload a CSV with a rollNo column first")
      return
    }

    setLoading(true)
    try {
      const result = await uploadElectiveRoster(parsedRollNumbers)
      if (result.missingRollNumbers.length > 0) {
        toast.warning("Roster uploaded with registry gaps", {
          description: `${result.enrolledCount} students were added. Missing from the master registry: ${result.missingRollNumbers.join(", ")}. Ask admin to add them there first, then re-upload those roll numbers.`,
        })
      } else {
        toast.success(`Added ${result.enrolledCount} students to the elective roster`)
      }
      setElectiveRosterOpen(false)
      setParsedRollNumbers([])
      setRosterErrors([])
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to upload the elective roster"))
    } finally {
      setLoading(false)
    }
  }

  const downloadElectiveTemplate = () => {
    const blob = new Blob(["rollNo\nCB.SC.U4CSE23001"], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "elective_roster_template.csv"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <CardTitle className="flex items-center text-lg">
              <BookOpen className="w-5 h-5 mr-2 text-emerald-600 dark:text-emerald-400" />
              {isElective ? "Elective Class" : "Section Allocation"}
            </CardTitle>
            <CardDescription className="mt-1">
              {isElective
                ? `This elective uses one dedicated class for ${workspaceLabel}. The mentor remains the default faculty, so roster management happens here without extra faculty mapping.`
                : `Assign section coordinators for ${workspaceLabel}. Faculty records themselves stay in the admin-side user roster.`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isElective ? (
              <Dialog open={electiveRosterOpen} onOpenChange={setElectiveRosterOpen}>
                <DialogTrigger render={<Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" />}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Elective Roster
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Upload Elective Roster</DialogTitle>
                    <DialogDescription>
                      Upload a CSV with a single <span className="font-medium">rollNo</span> column. Existing students from any home class can join this elective. Missing registry entries will be flagged so admin can add them later.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={downloadElectiveTemplate}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Template
                      </Button>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                        <Upload className="h-4 w-4" />
                        Choose CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleElectiveRosterUpload} />
                      </label>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                      The elective class stays separate from each student&apos;s home class. Uploading this roster only adds offering-specific enrollment for this elective.
                    </div>

                    {parsedRollNumbers.length > 0 ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                        Ready to add {parsedRollNumbers.length} roll numbers to the elective roster.
                      </div>
                    ) : null}

                    {rosterErrors.length > 0 ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                        {rosterErrors.join(" ")}
                      </div>
                    ) : null}
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setElectiveRosterOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="button" disabled={loading || parsedRollNumbers.length === 0} onClick={handleSubmitElectiveRoster} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      {loading ? "Uploading..." : "Add to Elective"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}

            {canManageUsers ? (
              <Button variant="outline" size="sm" render={<Link href="/dashboard/academic-setup" />}>
                Open Academic Setup
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-0 relative">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="w-[100px]">{isElective ? "Class" : "Section"}</TableHead>
                <TableHead className="w-[120px]">Enrolled</TableHead>
                <TableHead>{isElective ? "Teaching Owner" : "Assigned Coordinator"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500 py-6">No sections found. Add students first.</TableCell>
                </TableRow>
              ) : (
                sections.map(section => (
                  <TableRow key={section.id}>
                    <TableCell className="font-bold text-slate-700 dark:text-slate-300">
                      {section.compactName}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {section._count.students} Students
                    </TableCell>
                    <TableCell>
                      {isElective ? (
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                          {section.facultyId && section.facultyId !== "unassigned"
                            ? facultyMembers.find((faculty) => faculty.id === section.facultyId)?.user.name ?? "Mentor-owned"
                            : "Mentor-owned"}
                        </div>
                      ) : (
                        <Select 
                          value={section.facultyId || "unassigned"} 
                          onValueChange={(val) => handleAssign(section.id, val || "unassigned")}
                          disabled={assigningId === section.id}
                        >
                          <SelectTrigger className="w-[300px] bg-white dark:bg-slate-900">
                            {section.facultyId && section.facultyId !== "unassigned" 
                              ? facultyMembers.find(f => f.id === section.facultyId)?.user.name 
                              : <span className="text-slate-400 italic">Select faculty to assign</span>}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned" className="text-slate-400 italic">-- Unassigned --</SelectItem>
                            {facultyMembers.map(fm => (
                              <SelectItem key={fm.id} value={fm.id}>{fm.user.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
