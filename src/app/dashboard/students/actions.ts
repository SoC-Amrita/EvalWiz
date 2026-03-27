"use server"

import prisma from "@/lib/db"
import { revalidatePath } from "next/cache"
import {
  buildClassLabel,
  inferAcademicProgramLabel,
  normalizeSectionCode,
  parseStudentRollNumber,
} from "@/lib/roll-number"
import {
  requireAdminUser,
  requireAllowedSectionAccess,
  requireAuthenticatedWorkspaceState,
  requireRealWorkspace,
} from "@/lib/workspace-guards"

type StudentUploadRow = {
  rollNo: string
  name: string
  sectionName?: string
}

function normalizeText(value: string) {
  return value.trim()
}

function normalizeSectionName(value?: string) {
  return value?.trim().toLowerCase() ?? ""
}

async function resolveSectionIdForStudent(
  row: StudentUploadRow,
  options: {
    allowRollFallback: boolean
    createMissingHomeClass: boolean
  },
  sections: Array<{
    id: string
    name: string
    rollPrefix: string | null
    schoolCode: string | null
    levelCode: string | null
    programDurationYears: number | null
    programCode: string | null
    admissionYear: string | null
    sectionCode: string | null
  }>
) {
  const providedSectionName = normalizeSectionName(row.sectionName)
  if (providedSectionName) {
    const namedSection = sections.find((section) => normalizeSectionName(section.name) === providedSectionName)
    if (namedSection) {
      return namedSection.id
    }
  }

  if (!options.allowRollFallback) {
    throw new Error("Section information is required for this upload")
  }

  const parsedRollNo = parseStudentRollNumber(row.rollNo)
  if (!parsedRollNo) {
    throw new Error("Roll number format is invalid and no section name was provided")
  }

  const matches = sections.filter((section) => {
    return (
      section.rollPrefix?.toUpperCase() === parsedRollNo.rollPrefix &&
      section.schoolCode?.toUpperCase() === parsedRollNo.schoolCode &&
      section.levelCode?.toUpperCase() === parsedRollNo.levelCode &&
      section.programDurationYears === parsedRollNo.programDurationYears &&
      section.programCode?.toUpperCase() === parsedRollNo.programCode &&
      section.admissionYear === parsedRollNo.admissionYear &&
      normalizeSectionCode(section.sectionCode ?? "") === parsedRollNo.sectionCode
    )
  })

  if (matches.length === 1) {
    return matches[0].id
  }
  if (matches.length > 1) {
    throw new Error("Multiple classes match this roll number. Refine the class roll-signature metadata first")
  }

  if (options.createMissingHomeClass) {
    const programLabel = inferAcademicProgramLabel(parsedRollNo.levelCode, parsedRollNo.programDurationYears)
    const createdSection = await prisma.section.create({
      data: {
        name: buildClassLabel({
          programLabel,
          programCode: parsedRollNo.programCode,
          sectionCode: parsedRollNo.sectionCode,
          batchYear: parsedRollNo.admissionYear,
        }),
        isElectiveClass: false,
        program: programLabel,
        rollPrefix: parsedRollNo.rollPrefix,
        schoolCode: parsedRollNo.schoolCode,
        levelCode: parsedRollNo.levelCode,
        programDurationYears: parsedRollNo.programDurationYears,
        programCode: parsedRollNo.programCode,
        admissionYear: parsedRollNo.admissionYear,
        expectedGraduationYear: parsedRollNo.expectedGraduationYear,
        sectionCode: parsedRollNo.sectionCode,
        isActive: true,
      },
      select: { id: true },
    })

    sections.push({
      id: createdSection.id,
      name: buildClassLabel({
        programLabel,
        programCode: parsedRollNo.programCode,
        sectionCode: parsedRollNo.sectionCode,
        batchYear: parsedRollNo.admissionYear,
      }),
      rollPrefix: parsedRollNo.rollPrefix,
      schoolCode: parsedRollNo.schoolCode,
      levelCode: parsedRollNo.levelCode,
      programDurationYears: parsedRollNo.programDurationYears,
      programCode: parsedRollNo.programCode,
      admissionYear: parsedRollNo.admissionYear,
      sectionCode: parsedRollNo.sectionCode,
    })

    return createdSection.id
  }

  throw new Error("No class matches this roll number. Update the class roll-signature metadata or provide sectionName in the CSV")
}

export async function uploadStudents(students: StudentUploadRow[]) {
  const { user, activeWorkspace } = await requireAuthenticatedWorkspaceState()
  if (!user.isAdmin) throw new Error("Unauthorized")
  const isElectiveContext = Boolean(activeWorkspace.offeringId && activeWorkspace.isElective)
  const electiveSectionId = isElectiveContext
    ? await prisma.courseOfferingClass.findFirst({
        where: { offeringId: activeWorkspace.offeringId },
        select: { sectionId: true },
      }).then((assignment) => assignment?.sectionId ?? null)
    : null

  if (isElectiveContext && !electiveSectionId) {
    throw new Error("Elective offering class is missing. Re-save the offering in Academic Setup first")
  }

  let successCount = 0
  let errorCount = 0
  const errors: string[] = []
  const sections = await prisma.section.findMany({
    select: {
      id: true,
      name: true,
      rollPrefix: true,
      schoolCode: true,
      levelCode: true,
      programDurationYears: true,
      programCode: true,
      admissionYear: true,
      sectionCode: true,
    },
  })

  for (const student of students) {
    try {
      const normalizedRollNo = normalizeText(student.rollNo)
      const sectionId = await resolveSectionIdForStudent(
        student,
        {
          allowRollFallback: true,
          createMissingHomeClass: true,
        },
        sections
      )

      const savedStudent = await prisma.student.upsert({
        where: { rollNo: normalizedRollNo },
        update: { name: normalizeText(student.name), sectionId },
        create: { rollNo: normalizedRollNo, name: normalizeText(student.name), sectionId }
      })

      if (isElectiveContext && electiveSectionId) {
        await prisma.courseOfferingEnrollment.upsert({
          where: {
            offeringId_studentId: {
              offeringId: activeWorkspace.offeringId,
              studentId: savedStudent.id,
            },
          },
          update: {
            sectionId: electiveSectionId,
          },
          create: {
            offeringId: activeWorkspace.offeringId,
            studentId: savedStudent.id,
            sectionId: electiveSectionId,
          },
        })
      }
      successCount++
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected upload failure"
      errors.push(`Row ${student.rollNo}: ${message}`)
      errorCount++
    }
  }

  revalidatePath("/dashboard/students")
  revalidatePath("/dashboard/sections")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/academic-setup")
  revalidatePath("/dashboard/marks")
  revalidatePath("/dashboard/reports")
  revalidatePath("/dashboard/advanced-analytics")
  return { success: true, successCount, errorCount, errors }
}

export async function createStudentRecord(data: {
  rollNo: string
  name: string
  sectionId: string
}) {
  await requireAdminUser()

  const normalizedRollNo = normalizeText(data.rollNo)
  const normalizedName = normalizeText(data.name)
  const normalizedSectionId = normalizeText(data.sectionId)

  if (!normalizedRollNo) {
    throw new Error("Roll number is required")
  }
  if (!normalizedName) {
    throw new Error("Student name is required")
  }
  if (!normalizedSectionId) {
    throw new Error("Class / section is required")
  }

  const section = await prisma.section.findUnique({
    where: { id: normalizedSectionId },
    select: { id: true },
  })
  if (!section) {
    throw new Error("Selected class / section was not found")
  }

  const existingStudent = await prisma.student.findUnique({
    where: { rollNo: normalizedRollNo },
    select: { id: true },
  })
  if (existingStudent) {
    throw new Error("A student with this roll number already exists. Use Edit Student for manual reassignment.")
  }

  await prisma.student.create({
    data: {
      rollNo: normalizedRollNo,
      name: normalizedName,
      sectionId: normalizedSectionId,
    },
  })

  revalidatePath("/dashboard/students")
  revalidatePath("/dashboard/sections")
  revalidatePath("/dashboard")
  return { success: true }
}

export async function updateStudentRecord(data: {
  studentId: string
  rollNo: string
  name: string
  sectionId: string
}) {
  await requireAdminUser()

  await prisma.student.update({
    where: { id: data.studentId },
    data: {
      rollNo: normalizeText(data.rollNo),
      name: normalizeText(data.name),
      sectionId: data.sectionId,
    },
  })

  revalidatePath("/dashboard/students")
  revalidatePath("/dashboard/sections")
  revalidatePath("/dashboard")
  return { success: true }
}

export async function deleteStudentRecord(studentId: string) {
  await requireAdminUser()

  await prisma.student.delete({
    where: { id: studentId },
  })

  revalidatePath("/dashboard/students")
  revalidatePath("/dashboard/sections")
  revalidatePath("/dashboard")
  return { success: true }
}

export async function saveStudentMark(
  studentId: string,
  assessmentId: string,
  marks: number
) {
  const { user, activeWorkspace, allowedSectionIds } = await requireAllowedSectionAccess()
  if (!user.isAdmin) throw new Error("Unauthorized")
  requireRealWorkspace(activeWorkspace)

  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      offeringId: activeWorkspace.offeringId,
    },
  })
  if (!assessment) throw new Error("Assessment not found")
  if (marks < 0 || marks > assessment.maxMarks) {
    throw new Error(`Marks must be between 0 and ${assessment.maxMarks}`)
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { sectionId: true },
  })
  if (!student || !allowedSectionIds.has(student.sectionId)) {
    throw new Error("Unauthorized")
  }

  await prisma.mark.upsert({
    where: { studentId_assessmentId: { studentId, assessmentId } },
    update: { marks },
    create: { studentId, assessmentId, marks }
  })

  revalidatePath("/dashboard/students")
  return { success: true }
}
