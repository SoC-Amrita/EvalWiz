"use server"

import prisma from "@/lib/db"
import { requireAllowedSectionAccess, requireRealWorkspace } from "@/lib/workspace-guards"

async function getScopedExportContext() {
  const { activeWorkspace, allowedSectionIds } = await requireAllowedSectionAccess()
  requireRealWorkspace(activeWorkspace)

  return {
    activeWorkspace,
    allowedSectionIds,
  }
}

export async function fetchSectionData(sectionId: string, assessmentId: string) {
  const { activeWorkspace, allowedSectionIds } = await getScopedExportContext()
  if (!allowedSectionIds.has(sectionId)) {
    throw new Error("Unauthorized assignment")
  }

  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      offeringId: activeWorkspace.offeringId,
    },
    select: { id: true },
  })
  if (!assessment) {
    throw new Error("Assessment not found")
  }

  const students = await prisma.student.findMany({
    where: { sectionId },
    include: {
      marks: {
        where: { assessmentId }
      }
    },
    orderBy: { rollNo: "asc" }
  })

  return students.map(s => ({
    id: s.id,
    rollNo: s.rollNo,
    name: s.name,
    mark: s.marks[0]?.marks ?? null
  }))
}

export type SectionExportData = {
  meta: {
    department: string
    school: string
    institution: string
    subjectCode: string
    subjectTitle: string
    program: string
    academicYear: string
    term: string
    semester: string
    year: string
    mentors: string[]
    courseType: string
    evaluationPattern: string
    sectionLabel: string
    courseFaculty: string
  }
  section: {
    id: string
    name: string
    facultyName: string | null
  }
  assessments: Array<{
    id: string
    code: string
    name: string
    category: string
    maxMarks: number
    weightage: number
  }>
  students: Array<{
    id: string
    rollNo: string
    name: string
    marks: Record<string, number | null>
  }>
}

export async function fetchSectionExportData(
  sectionId: string,
  assessmentId?: string | null
): Promise<SectionExportData> {
  const { activeWorkspace, allowedSectionIds } = await getScopedExportContext()
  if (!allowedSectionIds.has(sectionId)) {
    throw new Error("Unauthorized assignment")
  }

  const assessments = await prisma.assessment.findMany({
    where: assessmentId
      ? { id: assessmentId, isActive: true, offeringId: activeWorkspace.offeringId }
      : { isActive: true, offeringId: activeWorkspace.offeringId },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      maxMarks: true,
      weightage: true,
    },
  })

  if (assessments.length === 0) {
    throw new Error("No active assessments found for export")
  }

  const selectedAssessmentIds = assessments.map((assessment) => assessment.id)

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      offeringAssignments: {
        where: { offeringId: activeWorkspace.offeringId },
        include: {
          faculty: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
        },
      },
      students: {
        orderBy: { rollNo: "asc" },
        include: {
          marks: {
            where: { assessmentId: { in: selectedAssessmentIds } },
            select: {
              assessmentId: true,
              marks: true,
            },
          },
        },
      },
    },
  })

  if (!section) {
    throw new Error("Section not found")
  }

  const mentorAssignments = await prisma.courseOfferingMentor.findMany({
    where: { offeringId: activeWorkspace.offeringId },
    orderBy: { user: { name: "asc" } },
    select: {
      user: {
        select: { name: true },
      },
    },
  })

  const mentorNames = mentorAssignments
    .map((mentor) => mentor.user.name)
    .filter((name): name is string => Boolean(name))

  const courseFaculty = section.offeringAssignments[0]?.faculty?.user.name ?? "Unassigned"

  return {
    meta: {
      department: "Department of Computer Science & Engineering",
      school: "School of Computing",
      institution: "Amrita Vishwa Vidyapeetham, Coimbatore",
      subjectCode: activeWorkspace.subjectCode,
      subjectTitle: activeWorkspace.subjectTitle,
      program: activeWorkspace.program,
      academicYear: activeWorkspace.academicYear,
      term: activeWorkspace.term,
      semester: activeWorkspace.semester,
      year: activeWorkspace.year,
      mentors: mentorNames,
      courseType: activeWorkspace.courseType,
      evaluationPattern: activeWorkspace.evaluationPattern,
      sectionLabel: section.name,
      courseFaculty,
    },
    section: {
      id: section.id,
      name: section.name,
      facultyName: courseFaculty,
    },
    assessments,
    students: section.students.map((student) => ({
      id: student.id,
      rollNo: student.rollNo,
      name: student.name,
      marks: Object.fromEntries(
        assessments.map((assessment) => [
          assessment.id,
          student.marks.find((mark) => mark.assessmentId === assessment.id)?.marks ?? null,
        ])
      ),
    })),
  }
}
