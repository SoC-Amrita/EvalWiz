"use client"

import { useState } from "react"
import type { User, Faculty, Section } from "@prisma/client"
import { toast } from "sonner"
import { KeyRound, Trash2, UserCog, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getErrorMessage } from "@/lib/client-errors"
import {
  createUserAccount,
  deleteUserAccount,
  resetUserPassword,
  updateUserIdentity,
} from "./actions"

type ManagedUser = Pick<
  User,
  "id" | "email" | "name" | "role" | "isAdmin" | "title" | "firstName" | "lastName"
> & {
  faculty: (Faculty & { sections: Section[] }) | null
  _count: {
    mentorAssignments: number
  }
}

function RoleBadges({ role, isAdmin }: { role: string; isAdmin: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {isAdmin ? (
        <Badge className="chip-soft-danger">
          ADMIN
        </Badge>
      ) : null}
      <Badge className="chip-soft-neutral">
        {role}
      </Badge>
    </div>
  )
}

export function UserAdminClient({
  users,
  currentUserId,
}: {
  users: ManagedUser[]
  currentUserId: string
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [resettingUser, setResettingUser] = useState<ManagedUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null)
  const [loading, setLoading] = useState(false)

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      await createUserAccount({
        title: formData.get("title") as string,
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        email: formData.get("email") as string,
        password: (formData.get("password") as string) || undefined,
        isAdmin: formData.get("isAdmin") === "on",
      })
      toast.success("User account created")
      setCreateOpen(false)
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create user"))
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingUser) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      await updateUserIdentity({
        userId: editingUser.id,
        title: formData.get("title") as string,
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        email: formData.get("email") as string,
        isAdmin: formData.get("isAdmin") === "on",
      })
      toast.success("User details updated")
      setEditingUser(null)
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update user"))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!resettingUser) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      await resetUserPassword(
        resettingUser.id,
        (formData.get("password") as string) || undefined
      )
      toast.success("Password reset successfully")
      setResettingUser(null)
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to reset password"))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    setLoading(true)

    try {
      await deleteUserAccount(deletingUser.id)
      toast.success("User account removed")
      setDeletingUser(null)
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to remove user"))
    } finally {
      setLoading(false)
    }
  }

  const facultyUsers = users.filter((user) => user.faculty)
  const mentors = facultyUsers.filter((user) => user._count.mentorAssignments > 0)
  const admins = users.filter((user) => user.isAdmin)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Administrators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{admins.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mentors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{mentors.length}</div>
            <p className="text-xs text-slate-500">
              Faculty assigned as mentors in at least one offering
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Faculty Accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {facultyUsers.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCog className="h-5 w-5 text-indigo-600" />
              Account Directory
            </CardTitle>
            <CardDescription className="mt-1">
              Admins can create or remove users, edit titled names, and set credentials. Mentor access is assigned per course offering in Academic Setup.
            </CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button className="bg-indigo-600 hover:bg-indigo-700 text-white" />}>
              <UserPlus className="mr-2 h-4 w-4" />
              New User
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Create User Account</DialogTitle>
                <DialogDescription>
                  Create a faculty account and independently grant admin access when needed.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">Title</Label>
                    <select id="title" name="title" defaultValue="Dr." className="col-span-3 h-9 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
                      <option value="Dr.">Dr.</option>
                      <option value="Prof.">Prof.</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="firstName" className="text-right">First Name</Label>
                    <Input id="firstName" name="firstName" className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="lastName" className="text-right">Last Name</Label>
                    <Input id="lastName" name="lastName" className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">Email</Label>
                    <Input id="email" name="email" type="email" className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="isAdmin" className="text-right">Admin Access</Label>
                    <div className="col-span-3 flex items-center gap-2">
                      <input id="isAdmin" name="isAdmin" type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        Allow this user to manage accounts and credentials
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right">Password</Label>
                    <Input id="password" name="password" type="password" className="col-span-3" placeholder="Defaults to faculty123, or admin123 when admin access is enabled" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {loading ? "Creating..." : "Create User"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Faculty Profile</TableHead>
                <TableHead>Sections</TableHead>
                <TableHead>Mentor Offerings</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="font-mono text-sm text-slate-500">{user.email}</TableCell>
                  <TableCell><RoleBadges role={user.role} isAdmin={user.isAdmin} /></TableCell>
                  <TableCell>{user.faculty ? "Yes" : "No"}</TableCell>
                  <TableCell>{user.faculty?.sections.length ?? 0}</TableCell>
                  <TableCell>{user._count.mentorAssignments}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingUser(user)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setResettingUser(user)}>
                        <KeyRound className="mr-1 h-3.5 w-3.5" />
                        Set / Reset Password
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={user.id === currentUserId}
                        onClick={() => setDeletingUser(user)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove User
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit User Details</DialogTitle>
            <DialogDescription>
              Update title, first and last names, and email address.
            </DialogDescription>
          </DialogHeader>
          {editingUser ? (
            <form onSubmit={handleUpdate}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-title" className="text-right">Title</Label>
                  <select id="edit-title" name="title" defaultValue={editingUser.title} className="col-span-3 h-9 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
                    <option value="Dr.">Dr.</option>
                    <option value="Prof.">Prof.</option>
                  </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-firstName" className="text-right">First Name</Label>
                  <Input id="edit-firstName" name="firstName" defaultValue={editingUser.firstName} className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-lastName" className="text-right">Last Name</Label>
                  <Input id="edit-lastName" name="lastName" defaultValue={editingUser.lastName} className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-email" className="text-right">Email</Label>
                  <Input id="edit-email" name="email" type="email" defaultValue={editingUser.email} className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-isAdmin" className="text-right">Admin Access</Label>
                  <div className="col-span-3 flex items-center gap-2">
                    <input id="edit-isAdmin" name="isAdmin" type="checkbox" defaultChecked={editingUser.isAdmin} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      Allow this user to manage accounts and credentials
                    </span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
            <DialogDescription>
              This permanently removes the selected account. Any assigned sections will become unassigned.
            </DialogDescription>
          </DialogHeader>
          {deletingUser ? (
            <>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-950 dark:bg-rose-950/40 dark:text-rose-200">
                <div className="font-semibold">{deletingUser.name}</div>
                <div className="text-xs opacity-80">{deletingUser.email}</div>
                <div className="mt-2">
                  Access: {deletingUser.isAdmin ? "Admin + " : ""}{deletingUser.role}
                  {deletingUser.faculty ? ` · Sections assigned: ${deletingUser.faculty.sections.length}` : ""}
                  {` · Mentor offerings: ${deletingUser._count.mentorAssignments}`}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeletingUser(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={loading || deletingUser.id === currentUserId}
                  onClick={handleDeleteUser}
                >
                  {loading ? "Removing..." : "Remove User"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resettingUser} onOpenChange={(open) => !open && setResettingUser(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Set / Reset Password</DialogTitle>
            <DialogDescription>
              Enter a new password, or leave this blank to apply the default password based on admin access.
            </DialogDescription>
          </DialogHeader>
          {resettingUser ? (
            <form onSubmit={handleResetPassword}>
              <div className="grid gap-4 py-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                  <div className="font-medium">{resettingUser.name}</div>
                  <div className="text-xs text-slate-500">{resettingUser.email}</div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="reset-password" className="text-right">New Password</Label>
                  <Input id="reset-password" name="password" type="password" className="col-span-3" placeholder={resettingUser.isAdmin ? "Defaults to admin123" : "Defaults to faculty123"} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
