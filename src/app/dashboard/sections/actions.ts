"use server"

import { auth } from "@/auth"
import prisma from "@/lib/db"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { buildNameFields } from "@/lib/user-names"
import { canManageUsers } from "@/lib/user-roles"
import { requireRealWorkspace, requireWorkspaceManagerState } from "@/lib/workspace-guards"

function splitLegacyName(name: string) {
  const trimmed = name.trim()
  const title = trimmed.startsWith("Prof.") ? "Prof." : "Dr."
  const withoutTitle = trimmed.replace(/^(Dr\.|Prof\.)\s+/, "").trim()
  const parts = withoutTitle.split(/\s+/)
  return {
    title,
    firstName: parts[0] || "Faculty",
    lastName: parts.slice(1).join(" ") || "User",
  }
}

export async function createFaculty(data: { name: string; email: string; password?: string }) {
  const session = await auth()
  if (!session?.user || !canManageUsers(session.user)) throw new Error("Unauthorized")

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email }
  })
  
  if (existingUser) throw new Error("A user with this email already exists")

  const pass = data.password || "faculty123"
  const hashedPassword = await bcrypt.hash(pass, 10)

  await prisma.$transaction(async (tx) => {
    const nameFields = buildNameFields(splitLegacyName(data.name))
    const user = await tx.user.create({
      data: {
        ...nameFields,
        email: data.email,
        password: hashedPassword,
        role: "FACULTY"
      }
    })

    await tx.faculty.create({
      data: {
        userId: user.id,
        name: nameFields.name
      }
    })
  })

  revalidatePath("/dashboard/sections")
  return { success: true }
}

export async function assignFacultyToSection(sectionId: string, facultyId: string | null) {
  const { activeWorkspace } = await requireWorkspaceManagerState()
  requireRealWorkspace(activeWorkspace, "Select an active course offering before assigning faculty")

  await prisma.courseOfferingClass.update({
    where: {
      offeringId_sectionId: {
        offeringId: activeWorkspace.offeringId,
        sectionId,
      },
    },
    data: { facultyId }
  })

  revalidatePath("/dashboard/sections")
  revalidatePath("/dashboard")
  return { success: true }
}

export async function editFaculty(facultyId: string, userId: string, data: { name: string; email: string }) {
  const session = await auth()
  if (!session?.user || !canManageUsers(session.user)) throw new Error("Unauthorized")

  const nameFields = buildNameFields(splitLegacyName(data.name))

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { ...nameFields, email: data.email }
    })
    
    await tx.faculty.update({
      where: { id: facultyId },
      data: { name: nameFields.name }
    })
  })

  revalidatePath("/dashboard/sections")
  revalidatePath("/dashboard/academic-setup")
  return { success: true }
}
