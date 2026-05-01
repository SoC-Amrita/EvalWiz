"use server"

import prisma from "@/lib/db"
import { revalidatePath } from "next/cache"
import {
  requireAuthenticatedWorkspaceState,
  requireRealWorkspace,
  requireWorkspaceManagerState,
} from "@/lib/workspace-guards"

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

export async function uploadElectiveRoster(rollNumbers: string[]) {
  const { activeWorkspace, activeRoleView } = await requireAuthenticatedWorkspaceState()
  requireRealWorkspace(activeWorkspace, "Select an active elective offering before uploading a roster")

  if (!activeWorkspace.isElective) {
    throw new Error("This roster upload is only available for elective offerings")
  }

  if (activeRoleView !== "mentor") {
    throw new Error("Only mentors can upload elective rosters")
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
