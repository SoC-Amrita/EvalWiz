"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Plus, Users, BookOpen, Edit } from "lucide-react"
import { createFaculty, assignFacultyToSection, editFaculty } from "./actions"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getErrorMessage } from "@/lib/client-errors"

type User = { id: string, name: string | null, email: string | null }
type FacultyMember = { id: string, user: User, _count: { offeringAssignments: number } }
type SectionWithFaculty = {
  id: string
  name: string
  facultyId: string | null
  _count: { students: number }
}

export function SectionsClient({ 
  sections,
  facultyMembers,
  canManageUsers,
  workspaceLabel,
}: { 
  sections: SectionWithFaculty[],
  facultyMembers: FacultyMember[],
  canManageUsers: boolean
  workspaceLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [editingFacultyMember, setEditingFacultyMember] = useState<FacultyMember | null>(null)
  const [loading, setLoading] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)

  const handleCreateFaculty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      await createFaculty({
        name: formData.get("name") as string,
        email: formData.get("email") as string,
        password: (formData.get("password") as string) || undefined
      })
      toast.success("Faculty member created successfully")
      setOpen(false)
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create faculty member"))
    } finally {
      setLoading(false)
    }
  }

  const handleEditFaculty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingFacultyMember) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      await editFaculty(editingFacultyMember.id, editingFacultyMember.user.id, {
        name: formData.get("name") as string,
        email: formData.get("email") as string,
      })
      toast.success("Faculty member updated")
      setEditingFacultyMember(null)
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update faculty member"))
    } finally {
      setLoading(false)
    }
  }

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

  return (
    <div className="space-y-8">
      {/* Faculty Roster */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <CardTitle className="flex items-center text-lg">
              <Users className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
              Faculty Roster
            </CardTitle>
            <CardDescription className="mt-1">
              Review the course faculty roster. Account creation, titles, mentor elevation, and password resets are handled in User Admin.
            </CardDescription>
          </div>
          {canManageUsers && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20" />}>
              <Plus className="w-4 h-4 mr-2" />
              Add Faculty
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create Faculty Account</DialogTitle>
                <DialogDescription>
                  This will create a new user with the FACULTY role. They can log in to manage their assigned sections.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateFaculty}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Full Name</Label>
                    <Input id="name" name="name" placeholder="Dr. Jane Doe" className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="jane.doe@amrita.edu" className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right">Password</Label>
                    <Input id="password" name="password" type="password" placeholder="(Defaults to 'faculty123')" className="col-span-3" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                    {loading ? "Creating..." : "Create Faculty"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {!canManageUsers && (
            <div className="px-1 py-4 text-sm text-slate-500">
              User records are admin-managed. Mentors can still assign sections below.
            </div>
          )}
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead>Faculty Name</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead className="text-right">Sections Handled</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facultyMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500 py-6">No faculty members found.</TableCell>
                </TableRow>
              ) : (
                facultyMembers.map(faculty => (
                  <TableRow key={faculty.id}>
                    <TableCell className="font-medium">{faculty.user.name}</TableCell>
                    <TableCell className="text-slate-500 font-mono text-sm">{faculty.user.email}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400">
                        {faculty._count.offeringAssignments} Assignment{faculty._count.offeringAssignments !== 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageUsers ? (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0" 
                          onClick={() => setEditingFacultyMember(faculty)}
                        >
                          <Edit className="h-4 w-4 text-slate-500 hover:text-indigo-600" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Edit Dialog */}
          <Dialog open={!!editingFacultyMember} onOpenChange={(val) => !val && setEditingFacultyMember(null)}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Edit Faculty Details</DialogTitle>
                <DialogDescription>
                  Update the name and email address for this faculty.
                </DialogDescription>
              </DialogHeader>
              {editingFacultyMember && (
                <form onSubmit={handleEditFaculty}>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="edit-name" className="text-right">Full Name</Label>
                      <Input id="edit-name" name="name" defaultValue={editingFacultyMember.user.name || ""} className="col-span-3" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="edit-email" className="text-right">Email</Label>
                      <Input id="edit-email" name="email" type="email" defaultValue={editingFacultyMember.user.email || ""} className="col-span-3" required />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setEditingFacultyMember(null)}>Cancel</Button>
                    <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      {loading ? "Saving..." : "Save Changes"}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>

        </CardContent>
      </Card>

      {/* Section Assignment */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <CardTitle className="flex items-center text-lg">
              <BookOpen className="w-5 h-5 mr-2 text-emerald-600 dark:text-emerald-400" />
              Section Mapping
            </CardTitle>
            <CardDescription className="mt-1">
              Assign which faculty coordinates each reusable class inside {workspaceLabel}.
            </CardDescription>
          </div>
          {canManageUsers ? (
            <Button variant="outline" size="sm" render={<Link href="/dashboard/academic-setup" />}>
              Open Academic Setup
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="pt-0 relative">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="w-[100px]">Section</TableHead>
                <TableHead className="w-[120px]">Enrolled</TableHead>
                <TableHead>Assigned Coordinator</TableHead>
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
                      {section.name}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {section._count.students} Students
                    </TableCell>
                    <TableCell>
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
