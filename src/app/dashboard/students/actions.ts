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
import { getAllowedStudentIdsForWorkspace } from "@/lib/course-workspace"

type StudentUploadRow = {
  rollNo: string
  name: string
  sectionName?: string
}

type ArchivedStudentSnapshot = {
  student: {
    id: string
    rollNo: string
    name: string
    sectionId: string
    sectionName: string
    excludeFromAnalytics: boolean
  }
  offeringEnrollments: Array<{
    offeringId: string
    subjectCode: string | null
    subjectTitle: string | null
    term: string
    academicYear: string
    semester: string
    year: string
    courseType: string
    evaluationPattern: string
    sectionId: string
    sectionName: string
  }>
  marks: Array<{
    assessmentId: string
    assessmentName: string
    assessmentCode: string
    category: string
    maxMarks: number
    weightage: number
    marks: number
    offeringId: string | null
    subjectCode: string | null
    subjectTitle: string | null
    term: string | null
    academicYear: string | null
    semester: string | null
    year: string | null
    courseType: string | null
    evaluationPattern: string | null
  }>
}

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

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

function revalidateStudentPaths() {
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/students")
  revalidatePath("/dashboard/sections")
  revalidatePath("/dashboard/academic-setup")
  revalidatePath("/dashboard/marks")
  revalidatePath("/dashboard/reports")
  revalidatePath("/dashboard/analytics")
  revalidatePath("/dashboard/advanced-analytics")
  revalidatePath("/dashboard/what-if")
}

function buildArchivedStudentSnapshot(student: {
  id: string
  rollNo: string
  name: string
  sectionId: string
  excludeFromAnalytics: boolean
  section: {
    name: string
  }
  offeringEnrollments: Array<{
    offeringId: string
    sectionId: string
    section: {
      name: string
    }
    offering: {
      term: string
      academicYear: string
      semester: string
      year: string
      courseType: string
      evaluationPattern: string
      subject: {
        code: string
        title: string
      }
    }
  }>
  marks: Array<{
    assessmentId: string
    marks: number
    assessment: {
      name: string
      code: string
      category: string
      maxMarks: number
      weightage: number
      offering: {
        id: string
        term: string
        academicYear: string
        semester: string
        year: string
        courseType: string
        evaluationPattern: string
        subject: {
          code: string
          title: string
        }
      } | null
    }
  }>
}): ArchivedStudentSnapshot {
  return {
    student: {
      id: student.id,
      rollNo: student.rollNo,
      name: student.name,
      sectionId: student.sectionId,
      sectionName: student.section.name,
      excludeFromAnalytics: student.excludeFromAnalytics,
    },
    offeringEnrollments: student.offeringEnrollments.map((enrollment) => ({
      offeringId: enrollment.offeringId,
      subjectCode: enrollment.offering.subject.code,
      subjectTitle: enrollment.offering.subject.title,
      term: enrollment.offering.term,
      academicYear: enrollment.offering.academicYear,
      semester: enrollment.offering.semester,
      year: enrollment.offering.year,
      courseType: enrollment.offering.courseType,
      evaluationPattern: enrollment.offering.evaluationPattern,
      sectionId: enrollment.sectionId,
      sectionName: enrollment.section.name,
    })),
    marks: student.marks.map((mark) => ({
      assessmentId: mark.assessmentId,
      assessmentName: mark.assessment.name,
      assessmentCode: mark.assessment.code,
      category: mark.assessment.category,
      maxMarks: mark.assessment.maxMarks,
      weightage: mark.assessment.weightage,
      marks: mark.marks,
      offeringId: mark.assessment.offering?.id ?? null,
      subjectCode: mark.assessment.offering?.subject.code ?? null,
      subjectTitle: mark.assessment.offering?.subject.title ?? null,
      term: mark.assessment.offering?.term ?? null,
      academicYear: mark.assessment.offering?.academicYear ?? null,
      semester: mark.assessment.offering?.semester ?? null,
      year: mark.assessment.offering?.year ?? null,
      courseType: mark.assessment.offering?.courseType ?? null,
      evaluationPattern: mark.assessment.offering?.evaluationPattern ?? null,
    })),
  }
}

async function getStudentArchiveSource(client: Pick<TransactionClient, "student">, studentId: string) {
  return client.student.findUnique({
    where: { id: studentId },
    include: {
      section: {
        select: { name: true },
      },
      offeringEnrollments: {
        include: {
          section: {
            select: { name: true },
          },
          offering: {
            include: {
              subject: {
                select: {
                  code: true,
                  title: true,
                },
              },
            },
          },
        },
      },
      marks: {
        include: {
          assessment: {
            include: {
              offering: {
                include: {
                  subject: {
                    select: {
                      code: true,
                      title: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
}

async function archiveStudentIntoHistory(
  tx: TransactionClient,
  options: {
    studentId: string
    actingUserId: string
    archiveReason: string
    deletionRequestId?: string | null
  }
) {
  const student = await getStudentArchiveSource(tx, options.studentId)
  if (!student) {
    throw new Error("Student not found")
  }

  const snapshot = buildArchivedStudentSnapshot(student)
  const archivedStudent = await tx.archivedStudent.create({
    data: {
      originalStudentId: student.id,
      rollNo: student.rollNo,
      name: student.name,
      sectionId: student.sectionId,
      sectionName: student.section.name,
      excludeFromAnalytics: student.excludeFromAnalytics,
      archivedByUserId: options.actingUserId,
      archiveReason: options.archiveReason,
      snapshot: JSON.stringify(snapshot),
    },
  })

  await tx.auditLog.create({
    data: {
      action: "STUDENT_ARCHIVE_DELETE",
      userId: options.actingUserId,
      details: JSON.stringify({
        studentId: student.id,
        rollNo: student.rollNo,
        name: student.name,
        markCount: student.marks.length,
        enrollmentCount: student.offeringEnrollments.length,
        archiveReason: options.archiveReason,
        archivedStudentId: archivedStudent.id,
        deletionRequestId: options.deletionRequestId ?? null,
      }),
    },
  })

  if (options.deletionRequestId) {
    await tx.studentDeletionRequest.update({
      where: { id: options.deletionRequestId },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedByUserId: options.actingUserId,
      },
    })
  } else {
    await tx.studentDeletionRequest.updateMany({
      where: {
        studentId: student.id,
        status: "PENDING",
      },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedByUserId: options.actingUserId,
        reviewNote: "Handled by direct admin delete",
      },
    })
  }

  await tx.student.delete({
    where: { id: student.id },
  })

  return archivedStudent
}

async function requireMentorScopedStudentAccess(studentId: string) {
  const workspaceState = await requireAuthenticatedWorkspaceState()
  if (workspaceState.activeRoleView !== "mentor") {
    throw new Error("Unauthorized")
  }
  requireRealWorkspace(workspaceState.activeWorkspace)

  const allowedStudentIds = new Set(
    await getAllowedStudentIdsForWorkspace(
      workspaceState.user,
      workspaceState.activeWorkspace,
      workspaceState.activeRoleView
    )
  )

  if (!allowedStudentIds.has(studentId)) {
    throw new Error("Unauthorized")
  }

  return workspaceState
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

  revalidateStudentPaths()
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

  revalidateStudentPaths()
  return { success: true }
}

export async function updateStudentRecord(data: {
  studentId: string
  rollNo: string
  name: string
  sectionId: string
  excludeFromAnalytics: boolean
}) {
  await requireAdminUser()

  await prisma.student.update({
    where: { id: data.studentId },
    data: {
      rollNo: normalizeText(data.rollNo),
      name: normalizeText(data.name),
      sectionId: data.sectionId,
      excludeFromAnalytics: data.excludeFromAnalytics,
    },
  })

  revalidateStudentPaths()
  return { success: true }
}

export async function setStudentAnalyticsExclusion(
  studentId: string,
  excludeFromAnalytics: boolean
) {
  try {
    const adminUser = await requireAdminUser()
    await prisma.student.update({
      where: { id: studentId },
      data: { excludeFromAnalytics },
    })

    await prisma.auditLog.create({
      data: {
        action: excludeFromAnalytics ? "STUDENT_EXCLUDED_FROM_ANALYTICS" : "STUDENT_INCLUDED_IN_ANALYTICS",
        userId: adminUser.id,
        details: JSON.stringify({
          studentId,
          excludeFromAnalytics,
          actorRole: "admin",
        }),
      },
    })
  } catch {
    const workspaceState = await requireMentorScopedStudentAccess(studentId)

    await prisma.student.update({
      where: { id: studentId },
      data: { excludeFromAnalytics },
    })

    await prisma.auditLog.create({
      data: {
        action: excludeFromAnalytics ? "STUDENT_EXCLUDED_FROM_ANALYTICS" : "STUDENT_INCLUDED_IN_ANALYTICS",
        userId: workspaceState.user.id,
        details: JSON.stringify({
          studentId,
          excludeFromAnalytics,
          actorRole: workspaceState.activeRoleView,
          offeringId: workspaceState.activeWorkspace.offeringId,
        }),
      },
    })
  }

  revalidateStudentPaths()
  return { success: true }
}

export async function requestStudentDeletion(studentId: string, reason?: string) {
  const workspaceState = await requireMentorScopedStudentAccess(studentId)
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      section: {
        select: { name: true },
      },
    },
  })
  if (!student) {
    throw new Error("Student not found")
  }

  const existingRequest = await prisma.studentDeletionRequest.findFirst({
    where: {
      studentId,
      status: "PENDING",
    },
    select: { id: true },
  })
  if (existingRequest) {
    throw new Error("A deletion request is already pending for this student")
  }

  await prisma.studentDeletionRequest.create({
    data: {
      studentId,
      studentRollNo: student.rollNo,
      studentName: student.name,
      sectionName: student.section.name,
      requestedByUserId: workspaceState.user.id,
      requestedByName: workspaceState.user.name ?? workspaceState.user.email ?? "Mentor",
      reason: reason?.trim() || null,
    },
  })

  await prisma.auditLog.create({
    data: {
      action: "STUDENT_DELETION_REQUESTED",
      userId: workspaceState.user.id,
      details: JSON.stringify({
        studentId,
        rollNo: student.rollNo,
        offeringId: workspaceState.activeWorkspace.offeringId,
        reason: reason?.trim() || null,
      }),
    },
  })

  revalidateStudentPaths()
  return { success: true }
}

export async function rejectStudentDeletionRequest(requestId: string, reviewNote?: string) {
  const adminUser = await requireAdminUser()
  await prisma.studentDeletionRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedByUserId: adminUser.id,
      reviewNote: reviewNote?.trim() || null,
    },
  })

  await prisma.auditLog.create({
    data: {
      action: "STUDENT_DELETION_REQUEST_REJECTED",
      userId: adminUser.id,
      details: JSON.stringify({
        requestId,
        reviewNote: reviewNote?.trim() || null,
      }),
    },
  })

  revalidateStudentPaths()
  return { success: true }
}

export async function approveStudentDeletionRequest(requestId: string) {
  const adminUser = await requireAdminUser()
  const request = await prisma.studentDeletionRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      studentId: true,
      status: true,
    },
  })
  if (!request || !request.studentId) {
    throw new Error("Deletion request not found")
  }
  if (request.status !== "PENDING") {
    throw new Error("Only pending deletion requests can be approved")
  }

  await prisma.$transaction(async (tx) => {
    await archiveStudentIntoHistory(tx, {
      studentId: request.studentId!,
      actingUserId: adminUser.id,
      archiveReason: "MENTOR_REQUEST_APPROVED",
      deletionRequestId: request.id,
    })
  })

  revalidateStudentPaths()
  return { success: true }
}

export async function deleteStudentRecord(studentId: string) {
  const adminUser = await requireAdminUser()
  await prisma.$transaction(async (tx) => {
    await archiveStudentIntoHistory(tx, {
      studentId,
      actingUserId: adminUser.id,
      archiveReason: "ADMIN_DELETE",
    })
  })

  revalidateStudentPaths()
  return { success: true }
}

export async function restoreArchivedStudent(archivedStudentId: string) {
  const adminUser = await requireAdminUser()
  const archivedStudent = await prisma.archivedStudent.findUnique({
    where: { id: archivedStudentId },
  })
  if (!archivedStudent) {
    throw new Error("Archived student not found")
  }
  if (archivedStudent.restoredAt) {
    throw new Error("This archived student has already been restored")
  }

  const snapshot = JSON.parse(archivedStudent.snapshot) as ArchivedStudentSnapshot
  const existingStudent = await prisma.student.findUnique({
    where: { rollNo: archivedStudent.rollNo },
    select: { id: true },
  })
  if (existingStudent) {
    throw new Error("A live student with this roll number already exists")
  }

  const section = await prisma.section.findUnique({
    where: { id: snapshot.student.sectionId },
    select: { id: true },
  })
  if (!section) {
    throw new Error("The original class or section no longer exists, so this student cannot be restored yet")
  }

  await prisma.$transaction(async (tx) => {
    const restoredStudent = await tx.student.create({
      data: {
        rollNo: snapshot.student.rollNo,
        name: snapshot.student.name,
        sectionId: snapshot.student.sectionId,
        excludeFromAnalytics: snapshot.student.excludeFromAnalytics,
      },
      select: { id: true },
    })

    for (const enrollment of snapshot.offeringEnrollments) {
      const offeringExists = await tx.courseOffering.findUnique({
        where: { id: enrollment.offeringId },
        select: { id: true },
      })
      const sectionExists = await tx.section.findUnique({
        where: { id: enrollment.sectionId },
        select: { id: true },
      })
      if (!offeringExists || !sectionExists) continue

      await tx.courseOfferingEnrollment.create({
        data: {
          offeringId: enrollment.offeringId,
          studentId: restoredStudent.id,
          sectionId: enrollment.sectionId,
        },
      })
    }

    for (const mark of snapshot.marks) {
      const assessmentExists = await tx.assessment.findUnique({
        where: { id: mark.assessmentId },
        select: { id: true },
      })
      if (!assessmentExists) continue

      await tx.mark.create({
        data: {
          studentId: restoredStudent.id,
          assessmentId: mark.assessmentId,
          marks: mark.marks,
        },
      })
    }

    await tx.archivedStudent.update({
      where: { id: archivedStudentId },
      data: {
        restoredAt: new Date(),
        restoredByUserId: adminUser.id,
        restoredStudentId: restoredStudent.id,
      },
    })

    await tx.auditLog.create({
      data: {
        action: "STUDENT_RESTORED",
        userId: adminUser.id,
        details: JSON.stringify({
          archivedStudentId,
          restoredStudentId: restoredStudent.id,
          rollNo: snapshot.student.rollNo,
        }),
      },
    })
  })

  revalidateStudentPaths()
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
