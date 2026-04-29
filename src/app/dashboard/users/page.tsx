import { redirect } from "next/navigation"

import { getSessionUser } from "@/lib/session"
import prisma from "@/lib/db"
import { canManageUsers } from "@/lib/user-roles"

import { UserAdminClient } from "./client"

export default async function UserAdminPage() {
  const user = await getSessionUser()
  if (!user) {
    redirect("/login")
  }
  if (!canManageUsers(user)) {
    redirect("/dashboard")
  }

  const users = await prisma.user.findMany({
    include: {
      faculty: {
        include: {
          sections: true,
        },
      },
      _count: {
        select: {
          mentorAssignments: true,
        },
      },
    },
    orderBy: [{ isAdmin: "desc" }, { name: "asc" }],
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          User Administration
        </h1>
        <p className="text-slate-500">
          Create or remove accounts, manage titled names and credentials, and use Academic Setup to assign mentors per course offering.
        </p>
      </div>

      <UserAdminClient users={users} currentUserId={user.id} />
    </div>
  )
}
