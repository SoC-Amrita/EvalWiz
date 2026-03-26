"use server"

import prisma from "@/lib/db"
import { revalidatePath } from "next/cache"
import { requireAllowedSectionAccess, requireRealWorkspace } from "@/lib/workspace-guards"

export async function saveStudentMark(studentId: string, assessmentId: string, marksStr: string) {
  const { user, activeWorkspace, allowedSectionIds } = await requireAllowedSectionAccess()
  requireRealWorkspace(activeWorkspace)

  const marks = parseFloat(marksStr)
  if (isNaN(marks)) throw new Error("Invalid mark")

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { sectionId: true },
  })
  if (!student || !allowedSectionIds.has(student.sectionId)) {
    throw new Error("Unauthorized to edit out-of-scope student")
  }

  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      offeringId: activeWorkspace.offeringId,
    },
  })
  if (!assessment) throw new Error("Assessment not found")
  if (marks > assessment.maxMarks) throw new Error(`Marks cannot exceed ${assessment.maxMarks}`)
  if (marks < 0) throw new Error("Marks cannot be negative")

  await prisma.mark.upsert({
    where: { studentId_assessmentId: { studentId, assessmentId } },
    update: { marks },
    create: { studentId, assessmentId, marks }
  })

  // Log the activity
  await prisma.auditLog.create({
    data: {
      action: "MARK_EDIT",
      userId: user.id,
      details: JSON.stringify({
        type: "single",
        assessmentId,
        studentId,
        marks,
        userName: user.name,
        assessmentCode: assessment.code,
        assessmentName: assessment.name,
        offeringId: activeWorkspace.offeringId,
      })
    }
  })

  return { success: true }
}

export async function bulkUploadMarks(
  sectionId: string, 
  assessmentId: string, 
  data: { rollNo: string, marks: number }[]
) {
  const { user, activeWorkspace, allowedSectionIds } = await requireAllowedSectionAccess()
  requireRealWorkspace(activeWorkspace)

  if (!allowedSectionIds.has(sectionId)) {
    throw new Error("Unauthorized assignment")
  }

  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      offeringId: activeWorkspace.offeringId,
    },
  })
  if (!assessment) throw new Error("Assessment not found")

  const students = await prisma.student.findMany({ where: { sectionId } })
  const studentMap = new Map(students.map(s => [s.rollNo, s.id]))

  let successCount = 0
  let errorCount = 0
  const errors: string[] = []

  for (const row of data) {
    try {
      if (row.marks > assessment.maxMarks || row.marks < 0) {
        errors.push(`Row ${row.rollNo}: Mark ${row.marks} out of bounds (0-${assessment.maxMarks})`)
        errorCount++
        continue
      }

      const studId = studentMap.get(row.rollNo)
      if (!studId) {
        errors.push(`Row ${row.rollNo}: Student not found in this section`)
        errorCount++
        continue
      }

      await prisma.mark.upsert({
        where: { studentId_assessmentId: { studentId: studId, assessmentId } },
        update: { marks: row.marks },
        create: { studentId: studId, assessmentId, marks: row.marks }
      })

      successCount++
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected upload failure"
      errors.push(`Row ${row.rollNo}: ${message}`)
      errorCount++
    }
  }

  revalidatePath("/dashboard/marks")

  // Log bulk upload activity
  if (successCount > 0) {
    await prisma.auditLog.create({
      data: {
        action: "BULK_MARK_UPLOAD",
        userId: user.id,
        details: JSON.stringify({
          type: "bulk",
          sectionId,
          assessmentId,
          offeringId: activeWorkspace.offeringId,
          assessmentCode: assessment.code,
          assessmentName: assessment.name,
          successCount,
          errorCount,
          userName: user.name,
        })
      }
    })
  }

  return { success: true, successCount, errorCount, errors }
}
