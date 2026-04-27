"use server"

import prisma from "@/lib/db"
import {
  buildAcademicPlacement,
  buildClassLabel,
  getDefaultSchoolCodeForProgramCode,
  inferAcademicProgramLabel,
  inferProgramCodeFromLabel,
  inferSectionCodeFromLabel,
  parseStudentRollNumber,
} from "@/lib/roll-number"
import { revalidatePath } from "next/cache"
import { requireAdminUser } from "@/lib/workspace-guards"

type ClassInput = {
  program: string
  term: string
  academicYear: string
  batchYear: string
  sectionCode: string
  isActive: boolean
}

type OfferingInput = {
  subjectId: string
  term: string
  academicYear: string
  semester: string
  year: string
  evaluationPattern: string
  courseType: string
  isElective: boolean
  isActive: boolean
  classAssignments: Array<{
    sectionId: string
    facultyId?: string | null
  }>
  mentorIds: string[]
}

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

function readRequiredText(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${label} is required`)
  }
  return trimmed
}

function normalizeIds(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function normalizeClassAssignments(assignments: OfferingInput["classAssignments"], options?: { allowEmpty?: boolean }) {
  const seenSectionIds = new Set<string>()
  const normalized: Array<{ sectionId: string; facultyId: string | null }> = []

  for (const assignment of assignments) {
    const sectionId = assignment.sectionId.trim()
    if (!sectionId || seenSectionIds.has(sectionId)) continue
    seenSectionIds.add(sectionId)
    normalized.push({
      sectionId,
      facultyId: assignment.facultyId?.trim() ? assignment.facultyId : null,
    })
  }

  if (normalized.length === 0 && !options?.allowEmpty) {
    throw new Error("Select at least one class for the course offering")
  }

  return normalized
}

function normalizeOfferingInput(data: OfferingInput): OfferingInput {
  const isElective = data.isElective
  const mentorIds = normalizeIds(data.mentorIds)
  if (isElective && mentorIds.length !== 1) {
    throw new Error("Elective offerings must have exactly one mentor, and that mentor becomes the default faculty")
  }
  return {
    subjectId: readRequiredText(data.subjectId, "Subject"),
    term: readRequiredText(data.term, "Term"),
    academicYear: readRequiredText(data.academicYear, "Academic year"),
    semester: readRequiredText(data.semester, "Semester"),
    year: readRequiredText(data.year, "Year"),
    evaluationPattern: readRequiredText(data.evaluationPattern, "Evaluation pattern"),
    courseType: readRequiredText(data.courseType, "Course type"),
    isElective,
    isActive: data.isActive,
    classAssignments: normalizeClassAssignments(data.classAssignments, { allowEmpty: isElective }),
    mentorIds,
  }
}

function normalizeClassInput(data: ClassInput, options?: { requireBatchYear?: boolean }) {
  const batchYear = data.batchYear.trim()
  if ((options?.requireBatchYear ?? true) && !batchYear) {
    throw new Error("Batch year is required")
  }

  const sectionCode = inferSectionCodeFromLabel(data.sectionCode)
  if (!sectionCode) {
    throw new Error("Section is required")
  }

  return {
    program: readRequiredText(data.program, "Academic program label"),
    term: readRequiredText(data.term, "Term"),
    academicYear: readRequiredText(data.academicYear, "Academic year"),
    batchYear,
    sectionCode,
    isActive: data.isActive,
  }
}

type SectionMatchRecord = {
  id: string
  name: string
  isElectiveClass?: boolean
  program: string | null
  rollPrefix: string | null
  schoolCode: string | null
  levelCode: string | null
  programDurationYears: number | null
  programCode: string | null
  admissionYear: string | null
  expectedGraduationYear: string | null
  sectionCode: string | null
  students?: Array<{
    rollNo: string
  }>
}

function computeExpectedGraduationYear(admissionYear: string, programDurationYears: number) {
  const parsedAdmissionYear = Number.parseInt(admissionYear, 10)
  if (!Number.isFinite(parsedAdmissionYear)) {
    return admissionYear
  }

  return String(parsedAdmissionYear + programDurationYears)
}

function inferProgramProfile(programLabel: string) {
  const normalized = programLabel.trim().toUpperCase()

  if (normalized.includes("BTECH") || normalized.includes("B TECH")) {
    return {
      levelCode: "U",
      programDurationYears: 4,
    }
  }

  return {
    levelCode: "U",
    programDurationYears: 4,
  }
}

function buildParsedRollFromClassInput(
  normalizedClass: ReturnType<typeof normalizeClassInput>,
  options?: { programCode?: string | null }
) {
  const programCode = options?.programCode ?? inferProgramCodeFromLabel(normalizedClass.program)
  if (!programCode) {
    throw new Error("Could not determine the roll program code from the academic program label")
  }

  const programProfile = inferProgramProfile(normalizedClass.program)

  return {
    normalizedRollNo: "",
    rollPrefix: "CB",
    schoolCode: getDefaultSchoolCodeForProgramCode(programCode) ?? "SC",
    schoolName: null,
    levelCode: programProfile.levelCode,
    programDurationYears: programProfile.programDurationYears,
    programCode,
    programName: null,
    admissionYear: normalizedClass.batchYear,
    expectedGraduationYear: computeExpectedGraduationYear(normalizedClass.batchYear, programProfile.programDurationYears),
    sectionCode: normalizedClass.sectionCode,
    sectionIndex: 0,
    rosterNumber: "",
  } as const
}

function getSampleParsedRoll(section: SectionMatchRecord) {
  const sampleRollNo = section.students?.[0]?.rollNo
  return sampleRollNo ? parseStudentRollNumber(sampleRollNo) : null
}

function getEffectiveProgramCode(section: SectionMatchRecord, fallbackProgramLabel?: string) {
  return (
    section.programCode ??
    getSampleParsedRoll(section)?.programCode ??
    inferProgramCodeFromLabel(section.program) ??
    inferProgramCodeFromLabel(fallbackProgramLabel)
  )
}

function getEffectiveSectionCode(section: SectionMatchRecord) {
  return section.sectionCode ?? getSampleParsedRoll(section)?.sectionCode ?? inferSectionCodeFromLabel(section.name)
}

function findExistingSectionMatch(
  existingSections: SectionMatchRecord[],
  parsedRoll: NonNullable<ReturnType<typeof parseStudentRollNumber>>,
  normalizedClass: ReturnType<typeof normalizeClassInput>
) {
  return existingSections.find((section) => {
    const sampleParsedRoll = getSampleParsedRoll(section)
    const programCode = section.programCode ?? sampleParsedRoll?.programCode ?? inferProgramCodeFromLabel(section.program)
    const sectionCode = section.sectionCode ?? sampleParsedRoll?.sectionCode ?? inferSectionCodeFromLabel(section.name)
    const admissionYear = section.admissionYear ?? sampleParsedRoll?.admissionYear

    if (programCode !== parsedRoll.programCode) return false
    if (sectionCode !== parsedRoll.sectionCode) return false
    if (admissionYear && admissionYear !== normalizedClass.batchYear) return false

    const schoolCode = section.schoolCode ?? sampleParsedRoll?.schoolCode
    if (schoolCode && schoolCode !== parsedRoll.schoolCode) return false

    const levelCode = section.levelCode ?? sampleParsedRoll?.levelCode
    if (levelCode && levelCode !== parsedRoll.levelCode) return false

    const programDurationYears = section.programDurationYears ?? sampleParsedRoll?.programDurationYears
    if (programDurationYears && programDurationYears !== parsedRoll.programDurationYears) return false

    return true
  })
}

function buildSectionUpdateFromParsedRoll(input: ReturnType<typeof normalizeClassInput>, parsedRoll: NonNullable<ReturnType<typeof parseStudentRollNumber>>) {
  const placement = buildAcademicPlacement({
    batchYear: input.batchYear,
    academicYear: input.academicYear,
    term: input.term,
  })

  return {
    name: buildClassLabel({
      programLabel: input.program,
      programCode: parsedRoll.programCode,
      sectionCode: parsedRoll.sectionCode,
      batchYear: input.batchYear,
    }),
    program: input.program || inferAcademicProgramLabel(parsedRoll.levelCode, parsedRoll.programDurationYears),
    term: input.term,
    academicYear: input.academicYear,
    semester: placement.semesterLabel,
    year: placement.yearLabel,
    rollPrefix: parsedRoll.rollPrefix,
    schoolCode: parsedRoll.schoolCode,
    levelCode: parsedRoll.levelCode,
    programDurationYears: parsedRoll.programDurationYears,
    programCode: parsedRoll.programCode,
    admissionYear: input.batchYear,
    expectedGraduationYear: parsedRoll.expectedGraduationYear,
    sectionCode: parsedRoll.sectionCode,
    isActive: input.isActive,
  }
}

function revalidateAcademicPaths() {
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/academic-setup")
  revalidatePath("/dashboard/assessments")
  revalidatePath("/dashboard/sections")
  revalidatePath("/dashboard/students")
  revalidatePath("/dashboard/marks")
  revalidatePath("/dashboard/analytics")
  revalidatePath("/dashboard/reports")
  revalidatePath("/dashboard/advanced-analytics")
}

async function ensureUniqueOffering(input: OfferingInput, excludeOfferingId?: string) {
  const duplicate = await prisma.courseOffering.findFirst({
    where: {
      subjectId: input.subjectId,
      term: input.term,
      academicYear: input.academicYear,
      semester: input.semester,
      year: input.year,
      ...(excludeOfferingId ? { id: { not: excludeOfferingId } } : {}),
    },
    select: { id: true },
  })

  if (duplicate) {
    throw new Error("An offering already exists for this subject, term, academic year, semester, and year")
  }
}

async function syncOfferingRelations(
  tx: Pick<typeof prisma, "courseOfferingClass" | "courseOfferingMentor">,
  offeringId: string,
  input: OfferingInput
) {
  await tx.courseOfferingClass.deleteMany({
    where: { offeringId },
  })
  await tx.courseOfferingMentor.deleteMany({
    where: { offeringId },
  })

  if (input.classAssignments.length > 0) {
    await tx.courseOfferingClass.createMany({
      data: input.classAssignments.map((assignment) => ({
        offeringId,
        sectionId: assignment.sectionId,
        facultyId: assignment.facultyId,
      })),
    })
  }

  if (input.mentorIds.length > 0) {
    await tx.courseOfferingMentor.createMany({
      data: input.mentorIds.map((userId) => ({
        offeringId,
        userId,
      })),
    })
  }
}

function buildElectiveClassName(subjectCode: string, academicYear: string, term: string) {
  return `${subjectCode} Elective Class (${academicYear} · ${term})`
}

async function resolveElectiveFacultyId(tx: TransactionClient, mentorUserId: string) {
  const faculty = await tx.faculty.findUnique({
    where: { userId: mentorUserId },
    select: { id: true },
  })

  if (!faculty) {
    throw new Error("The selected elective mentor must also have a faculty profile")
  }

  return faculty.id
}

async function ensureElectiveSection(
  tx: TransactionClient,
  input: OfferingInput,
  subject: { code: string; program: string },
  existingSectionId?: string | null
) {
  const sectionName = buildElectiveClassName(subject.code, input.academicYear, input.term)
  const sectionData = {
    name: sectionName,
    isElectiveClass: true,
    isActive: input.isActive,
    program: subject.program,
    term: input.term,
    academicYear: input.academicYear,
    semester: input.semester,
    year: input.year,
    evaluationPattern: input.evaluationPattern,
    courseType: input.courseType,
  }

  if (existingSectionId) {
    const updated = await tx.section.update({
      where: { id: existingSectionId },
      data: sectionData,
      select: { id: true },
    })
    return updated.id
  }

  const created = await tx.section.create({
    data: sectionData,
    select: { id: true },
  })

  return created.id
}

async function syncCourseOffering(
  tx: TransactionClient,
  offeringId: string,
  input: OfferingInput,
  options: {
    existingElectiveSectionId?: string | null
  } = {}
) {
  if (!input.isElective) {
    await syncOfferingRelations(tx, offeringId, input)
    return
  }

  const subject = await tx.subject.findUnique({
    where: { id: input.subjectId },
    select: { code: true, program: true },
  })

  if (!subject) {
    throw new Error("Subject not found")
  }

  const mentorUserId = input.mentorIds[0]
  const facultyId = await resolveElectiveFacultyId(tx, mentorUserId)
  const sectionId = await ensureElectiveSection(tx, input, subject, options.existingElectiveSectionId)

  await syncOfferingRelations(tx, offeringId, {
    ...input,
    classAssignments: [
      {
        sectionId,
        facultyId,
      },
    ],
  })
}

export async function createSubject(data: {
  code: string
  title: string
  program: string
  isActive: boolean
}) {
  await requireAdminUser()

  await prisma.subject.create({
    data: {
      code: readRequiredText(data.code, "Subject code"),
      title: readRequiredText(data.title, "Subject title"),
      program: readRequiredText(data.program, "Program"),
      isActive: data.isActive,
    },
  })

  revalidateAcademicPaths()
  return { success: true }
}

export async function updateSubject(subjectId: string, data: {
  code: string
  title: string
  program: string
  isActive: boolean
}) {
  await requireAdminUser()

  await prisma.subject.update({
    where: { id: subjectId },
    data: {
      code: readRequiredText(data.code, "Subject code"),
      title: readRequiredText(data.title, "Subject title"),
      program: readRequiredText(data.program, "Program"),
      isActive: data.isActive,
    },
  })

  revalidateAcademicPaths()
  return { success: true }
}

export async function deleteSubject(subjectId: string) {
  await requireAdminUser()

  const offeringCount = await prisma.courseOffering.count({
    where: { subjectId },
  })
  if (offeringCount > 0) {
    throw new Error("Delete the linked course offerings before removing this subject")
  }

  await prisma.subject.delete({
    where: { id: subjectId },
  })

  revalidateAcademicPaths()
  return { success: true }
}

export async function createClass(data: ClassInput) {
  await requireAdminUser()
  const normalizedClass = normalizeClassInput(data)
  const desiredProgramCode = inferProgramCodeFromLabel(normalizedClass.program)
  if (!desiredProgramCode) {
    throw new Error("Academic program label must include a recognizable roll program code such as CSE or ECE")
  }
  const existingSections = await prisma.section.findMany({
    where: {
      isElectiveClass: false,
    },
    select: {
      id: true,
      name: true,
      isElectiveClass: true,
      program: true,
      rollPrefix: true,
      schoolCode: true,
      levelCode: true,
      programDurationYears: true,
      programCode: true,
      admissionYear: true,
      expectedGraduationYear: true,
      sectionCode: true,
      students: {
        select: {
          rollNo: true,
        },
        orderBy: { rollNo: "asc" },
        take: 1,
      },
    },
  })
  const students = await prisma.student.findMany({
    select: {
      id: true,
      rollNo: true,
    },
    orderBy: { rollNo: "asc" },
  })

  const matchingStudents = students.flatMap((student) => {
    const parsedRoll = parseStudentRollNumber(student.rollNo)
    if (!parsedRoll) return []
    if (parsedRoll.admissionYear !== normalizedClass.batchYear) return []
    if (parsedRoll.programCode !== desiredProgramCode) return []
    if (parsedRoll.sectionCode !== normalizedClass.sectionCode) return []
    return [{ studentId: student.id, parsedRoll }]
  })

  const parsedRoll =
    matchingStudents[0]?.parsedRoll ??
    buildParsedRollFromClassInput(normalizedClass, { programCode: desiredProgramCode })

  const dataForSection = buildSectionUpdateFromParsedRoll(normalizedClass, parsedRoll)
  const existingSection = findExistingSectionMatch(existingSections, parsedRoll, normalizedClass)

  let sectionId = existingSection?.id

  if (existingSection) {
    await prisma.section.update({
      where: { id: existingSection.id },
      data: dataForSection,
    })
  } else {
    const createdSection = await prisma.section.create({
      data: {
        ...dataForSection,
        isElectiveClass: false,
      },
    })
    sectionId = createdSection.id
  }

  if (sectionId && matchingStudents.length > 0) {
    await prisma.student.updateMany({
      where: {
        id: { in: matchingStudents.map((student) => student.studentId) },
      },
      data: {
        sectionId,
      },
    })
  }

  revalidateAcademicPaths()
  return { success: true, syncedCount: matchingStudents.length }
}

export async function updateClass(sectionId: string, data: ClassInput) {
  await requireAdminUser()
  const normalizedClass = normalizeClassInput(data, { requireBatchYear: false })
  const existingSection = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      id: true,
      name: true,
      program: true,
      rollPrefix: true,
      schoolCode: true,
      levelCode: true,
      programDurationYears: true,
      programCode: true,
      admissionYear: true,
      expectedGraduationYear: true,
      sectionCode: true,
      isElectiveClass: true,
      students: {
        select: {
          rollNo: true,
        },
        orderBy: { rollNo: "asc" },
        take: 1,
      },
    },
  })

  if (!existingSection) {
    throw new Error("Class not found")
  }
  if (existingSection.isElectiveClass) {
    throw new Error("Elective classes are managed through their course offering and cannot be edited from the reusable class catalog")
  }

  const sampleParsedRoll = getSampleParsedRoll(existingSection)
  const programCode = getEffectiveProgramCode(existingSection, normalizedClass.program)
  const sectionCode = normalizedClass.sectionCode || getEffectiveSectionCode(existingSection)
  const batchYear = normalizedClass.batchYear || existingSection.admissionYear || sampleParsedRoll?.admissionYear
  const programDurationYears = existingSection.programDurationYears ?? sampleParsedRoll?.programDurationYears ?? 4

  if (!programCode) {
    throw new Error("Could not determine the class roll program code. Sync the class from student roll numbers first.")
  }
  if (!sectionCode) {
    throw new Error("Could not determine the class section code. Rename or sync the class first.")
  }
  if (!batchYear) {
    throw new Error("Batch year is required. Enter it here or import at least one student with a valid roll number.")
  }

  const parsedRoll = {
    normalizedRollNo: "",
    rollPrefix: existingSection.rollPrefix ?? "CB",
    schoolCode: existingSection.schoolCode ?? sampleParsedRoll?.schoolCode ?? getDefaultSchoolCodeForProgramCode(programCode) ?? "SC",
    schoolName: null,
    levelCode: existingSection.levelCode ?? sampleParsedRoll?.levelCode ?? "U",
    programDurationYears,
    programCode,
    programName: null,
    admissionYear: batchYear,
    expectedGraduationYear: computeExpectedGraduationYear(batchYear, programDurationYears),
    sectionCode,
    sectionIndex: 0,
    rosterNumber: "",
  } as const
  const dataForSection = buildSectionUpdateFromParsedRoll(
    {
      ...normalizedClass,
      batchYear,
    },
    parsedRoll
  )

  await prisma.section.update({
    where: { id: sectionId },
    data: dataForSection,
  })

  revalidateAcademicPaths()
  return { success: true }
}

export async function deleteClass(sectionId: string) {
  await requireAdminUser()

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      isElectiveClass: true,
      _count: {
        select: {
          students: true,
          offeringAssignments: true,
        },
      },
    },
  })

  if (!section) {
    throw new Error("Class not found")
  }
  if (section.isElectiveClass) {
    throw new Error("Elective classes are managed automatically by their offering and cannot be deleted from the reusable class catalog")
  }
  if (section._count.students > 0) {
    throw new Error("Remove the enrolled students before deleting this class")
  }
  if (section._count.offeringAssignments > 0) {
    throw new Error("Detach this class from course offerings before deleting it")
  }

  await prisma.section.delete({
    where: { id: sectionId },
  })

  revalidateAcademicPaths()
  return { success: true }
}

export async function createCourseOffering(data: OfferingInput) {
  await requireAdminUser()

  const normalizedInput = normalizeOfferingInput(data)

  await ensureUniqueOffering(normalizedInput)

  await prisma.$transaction(async (tx) => {
    const offering = await tx.courseOffering.create({
      data: {
        subjectId: normalizedInput.subjectId,
        term: normalizedInput.term,
        academicYear: normalizedInput.academicYear,
        semester: normalizedInput.semester,
        year: normalizedInput.year,
        evaluationPattern: normalizedInput.evaluationPattern,
        courseType: normalizedInput.courseType,
        isElective: normalizedInput.isElective,
        isActive: normalizedInput.isActive,
      },
    })

    await syncCourseOffering(tx, offering.id, normalizedInput)
  })

  revalidateAcademicPaths()
  return { success: true }
}

export async function updateCourseOffering(offeringId: string, data: OfferingInput) {
  await requireAdminUser()

  const normalizedInput = normalizeOfferingInput(data)

  await ensureUniqueOffering(normalizedInput, offeringId)

  await prisma.$transaction(async (tx) => {
    const existingElectiveSectionId = normalizedInput.isElective
      ? await tx.courseOfferingClass.findFirst({
          where: { offeringId },
          select: { sectionId: true },
        }).then((assignment) => assignment?.sectionId ?? null)
      : null

    await tx.courseOffering.update({
      where: { id: offeringId },
      data: {
        subjectId: normalizedInput.subjectId,
        term: normalizedInput.term,
        academicYear: normalizedInput.academicYear,
        semester: normalizedInput.semester,
        year: normalizedInput.year,
        evaluationPattern: normalizedInput.evaluationPattern,
        courseType: normalizedInput.courseType,
        isElective: normalizedInput.isElective,
        isActive: normalizedInput.isActive,
      },
    })

    await syncCourseOffering(tx, offeringId, normalizedInput, {
      existingElectiveSectionId,
    })
  })

  revalidateAcademicPaths()
  return { success: true }
}

export async function deleteCourseOffering(offeringId: string) {
  await requireAdminUser()

  const assessmentCount = await prisma.assessment.count({
    where: { offeringId },
  })
  if (assessmentCount > 0) {
    throw new Error("Delete the assessment structure first before removing this course offering")
  }

  await prisma.courseOffering.delete({
    where: { id: offeringId },
  })

  revalidateAcademicPaths()
  return { success: true }
}

// Semester rollover still reuses the current class roster records. If rollover
// becomes a routine workflow, this needs immutable roster snapshots so future
// edits never change historical enrollment views.
