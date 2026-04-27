"use server"

import prisma from "@/lib/db"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { buildNameFields } from "@/lib/user-names"
import {
  requireAdminUser,
  requireAuthenticatedWorkspaceState,
  requireRealWorkspace,
  requireWorkspaceManagerState,
} from "@/lib/workspace-guards"

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
  await requireAdminUser()

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email }
  })
  
  if (existingUser) throw new Error("A user with this email already exists")

  const pass = data.password?.trim()
  if (!pass) {
    throw new Error("Password is required")
  }
  if (pass.length < 8) {
    throw new Error("Password must be at least 8 characters long")
  }
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
  if (activeWorkspace.isElective) {
    throw new Error("Elective offerings use the mentor as the default faculty and do not support separate faculty reassignment")
  }

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
  await requireAdminUser()

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

export async function uploadElectiveRoster(rollNumbers: string[]) {
  const { activeWorkspace, activeRoleView } = await requireAuthenticatedWorkspaceState()
  requireRealWorkspace(activeWorkspace, "Select an active elective offering before uploading a roster")

  if (!activeWorkspace.isElective) {
    throw new Error("This roster upload is only available for elective offerings")
  }

  if (activeRoleView === "administrator") {
    throw new Error("Open the elective workspace view before uploading its roster")
  }

  const normalizedRollNumbers = [...new Set(rollNumbers.map((value) => value.trim().toUpperCase()).filter(Boolean))]
  if (normalizedRollNumbers.length === 0) {
    throw new Error("Add at least one roll number before uploading the elective roster")
  }

  const electiveAssignment = await prisma.courseOfferingClass.findFirst({
    where: { offeringId: activeWorkspace.offeringId },
    select: { sectionId: true },
  })

  if (!electiveAssignment) {
    throw new Error("Elective offering class is missing. Re-save the offering in Academic Setup first")
  }

  const existingStudents = await prisma.student.findMany({
    where: {
      rollNo: { in: normalizedRollNumbers },
    },
    select: {
      id: true,
      rollNo: true,
    },
  })

  const studentIdsByRollNumber = new Map(
    existingStudents.map((student) => [student.rollNo.trim().toUpperCase(), student.id])
  )
  const missingRollNumbers = normalizedRollNumbers.filter((rollNo) => !studentIdsByRollNumber.has(rollNo))

  let enrolledCount = 0
  for (const student of existingStudents) {
    await prisma.courseOfferingEnrollment.upsert({
      where: {
        offeringId_studentId: {
          offeringId: activeWorkspace.offeringId,
          studentId: student.id,
        },
      },
      update: {
        sectionId: electiveAssignment.sectionId,
      },
      create: {
        offeringId: activeWorkspace.offeringId,
        studentId: student.id,
        sectionId: electiveAssignment.sectionId,
      },
    })
    enrolledCount += 1
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/sections")
  revalidatePath("/dashboard/marks")
  revalidatePath("/dashboard/reports")
  revalidatePath("/dashboard/analytics")
  revalidatePath("/dashboard/advanced-analytics")

  return {
    success: true,
    enrolledCount,
    missingRollNumbers,
  }
}
