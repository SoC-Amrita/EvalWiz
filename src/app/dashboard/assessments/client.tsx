"use client"

import { useState } from "react"
import type { Assessment } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { MoreHorizontal, Pencil, Plus, Power, Trash2 } from "lucide-react"
import { createAssessment, updateAssessment, toggleAssessmentStatus, deleteAssessment } from "./actions"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { classifyAssessment } from "@/lib/assessment-structure"

export function AssessmentClient({ data }: { data: Assessment[] }) {
  const [open, setOpen] = useState(false)
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null)
  const [loading, setLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("CA_QUIZ")
  const [selectedComponentType, setSelectedComponentType] = useState("INTERNAL")
  const [editingCategory, setEditingCategory] = useState("CA_QUIZ")
  const [editingComponentType, setEditingComponentType] = useState("INTERNAL")

  const categoryOptions = [
    { value: "CA_QUIZ", label: "CA / Quiz" },
    { value: "CA_REVIEW", label: "CA / Review" },
    { value: "MID_TERM", label: "Mid Term" },
    { value: "END_SEMESTER", label: "End Semester" },
  ] as const

  const getCategoryLabel = (value: string) =>
    categoryOptions.find((option) => option.value === value)?.label ?? "Select type"

  const componentTypeOptions = [
    { value: "INTERNAL", label: "Internal" },
    { value: "EXTERNAL", label: "External" },
  ] as const

  const getComponentTypeLabel = (value: string) =>
    componentTypeOptions.find((option) => option.value === value)?.label ?? "Internal"

  const getStructuredCategoryLabel = (assessment: Assessment) => {
    const classification = classifyAssessment(assessment)
    if (classification.family === "CONTINUOUS_ASSESSMENT") {
      return classification.subcomponentLabel
        ? `CA / ${classification.subcomponentLabel}`
        : "Continuous Assessment"
    }
    return classification.familyLabel
  }

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      await createAssessment({
        name: formData.get("name") as string,
        code: formData.get("code") as string,
        category: selectedCategory,
        componentType: selectedComponentType,
        maxMarks: Number(formData.get("maxMarks")),
        weightage: Number(formData.get("weightage")),
        displayOrder: Number(formData.get("displayOrder")),
        isActive: true,
        includeInAgg: true,
      })
      toast.success("Assessment component created successfully")
      setOpen(false)
      setSelectedCategory("CA_QUIZ")
      setSelectedComponentType("INTERNAL")
    } catch {
      toast.error("Failed to create assessment component. Code might be duplicate.")
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      await toggleAssessmentStatus(id, currentStatus)
      toast.success("Status updated")
    } catch {
      toast.error("Failed to update status")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will delete all marks associated with this component!")) return
    try {
      await deleteAssessment(id)
      toast.success("Component deleted")
    } catch {
      toast.error("Failed to delete component")
    }
  }

  const openEditDialog = (assessment: Assessment) => {
    setEditingAssessment(assessment)
    setEditingCategory(assessment.category)
    setEditingComponentType(assessment.componentType)
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingAssessment) return

    setEditLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      await updateAssessment({
        assessmentId: editingAssessment.id,
        name: formData.get("name") as string,
        code: formData.get("code") as string,
        category: editingCategory,
        componentType: editingComponentType,
        maxMarks: Number(formData.get("maxMarks")),
        weightage: Number(formData.get("weightage")),
        displayOrder: Number(formData.get("displayOrder")),
        includeInAgg: editingAssessment.includeInAgg,
      })
      toast.success("Assessment component updated successfully")
      setEditingAssessment(null)
    } catch {
      toast.error("Failed to update assessment component. Code might be duplicate.")
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Filtering could go here */}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20" />}>
            <Plus className="w-4 h-4 mr-2" />
            New Component
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Assessment Component</DialogTitle>
              <DialogDescription>
                Define a new evaluation metric for the course.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" name="name" placeholder="Midterm 1" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="code" className="text-right">Short Code</Label>
                  <Input id="code" name="code" placeholder="MID1" className="col-span-3 uppercase" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="category" className="text-right">Category</Label>
                  <div className="col-span-3">
                    <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value ?? "CA_QUIZ")}>
                      <SelectTrigger>
                        {getCategoryLabel(selectedCategory)}
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="componentType" className="text-right">Type</Label>
                  <div className="col-span-3">
                    <Select value={selectedComponentType} onValueChange={(value) => setSelectedComponentType(value ?? "INTERNAL")}>
                      <SelectTrigger>
                        {getComponentTypeLabel(selectedComponentType)}
                      </SelectTrigger>
                      <SelectContent>
                        {componentTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="maxMarks" className="text-right">Max Marks</Label>
                  <Input id="maxMarks" name="maxMarks" type="number" step="0.5" defaultValue="10" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="weightage" className="text-right">Contrib %</Label>
                  <Input id="weightage" name="weightage" type="number" step="0.5" defaultValue="5" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="displayOrder" className="text-right">Order</Label>
                  <Input id="displayOrder" name="displayOrder" type="number" defaultValue={data.length + 1} className="col-span-3" required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  {loading ? "Saving..." : "Create Component"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!editingAssessment} onOpenChange={(open) => !open && setEditingAssessment(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Assessment Component</DialogTitle>
            <DialogDescription>
              Update the structure and definition of this evaluation metric.
            </DialogDescription>
          </DialogHeader>
          {editingAssessment ? (
            <form onSubmit={handleUpdate}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">Name</Label>
                  <Input id="edit-name" name="name" defaultValue={editingAssessment.name} className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-code" className="text-right">Short Code</Label>
                  <Input id="edit-code" name="code" defaultValue={editingAssessment.code} className="col-span-3 uppercase" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-category" className="text-right">Category</Label>
                  <div className="col-span-3">
                    <Select value={editingCategory} onValueChange={(value) => setEditingCategory(value ?? editingAssessment.category)}>
                      <SelectTrigger>
                        {getCategoryLabel(editingCategory)}
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-component-type" className="text-right">Type</Label>
                  <div className="col-span-3">
                    <Select
                      value={editingComponentType}
                      onValueChange={(value) => setEditingComponentType(value ?? editingAssessment.componentType)}
                    >
                      <SelectTrigger>
                        {getComponentTypeLabel(editingComponentType)}
                      </SelectTrigger>
                      <SelectContent>
                        {componentTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-maxMarks" className="text-right">Max Marks</Label>
                  <Input
                    id="edit-maxMarks"
                    name="maxMarks"
                    type="number"
                    step="0.5"
                    defaultValue={editingAssessment.maxMarks}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-weightage" className="text-right">Contrib %</Label>
                  <Input
                    id="edit-weightage"
                    name="weightage"
                    type="number"
                    step="0.5"
                    defaultValue={editingAssessment.weightage}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-displayOrder" className="text-right">Order</Label>
                  <Input
                    id="edit-displayOrder"
                    name="displayOrder"
                    type="number"
                    defaultValue={editingAssessment.displayOrder}
                    className="col-span-3"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingAssessment(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {editLoading ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
            <TableRow>
              <TableHead className="w-[80px]">Order</TableHead>
              <TableHead>Component Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Max Marks</TableHead>
              <TableHead className="text-right">Weightage</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                  No components created yet.
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={item.id} className="group">
                  <TableCell className="font-medium text-slate-500">{item.displayOrder}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="chip-soft-primary font-mono">
                      {item.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="chip-soft-neutral">
                      {getStructuredCategoryLabel(item)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        item.componentType === "EXTERNAL"
                          ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                      }
                    >
                      {getComponentTypeLabel(item.componentType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{item.maxMarks}</TableCell>
                  <TableCell className="text-right text-slate-500 font-medium">{item.weightage}%</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={item.isActive ? "default" : "destructive"}
                      className={item.isActive ? "chip-soft-success border-0 shadow-none" : "chip-soft-danger border-0 shadow-none"}
                    >
                      {item.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openEditDialog(item)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit component
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggle(item.id, item.isActive)}>
                            <Power className="mr-2 h-4 w-4" />
                            {item.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete safely
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
