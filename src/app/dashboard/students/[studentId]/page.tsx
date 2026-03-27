import { auth } from "@/auth"
import prisma from "@/lib/db"
import { redirect } from "next/navigation"

import { StudentRecordClient } from "../record-client"

export default async function StudentRecordPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const session = await auth()
  const user = session?.user
  if (!user) {
    redirect("/login")
  }
  if (!user.isAdmin) {
    redirect("/dashboard")
  }

  const { studentId } = await params

  const [student, sections] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      include: {
        section: true,
        marks: {
          include: {
            assessment: {
              include: {
                offering: {
                  include: {
                    subject: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.section.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  if (!student) {
    redirect("/dashboard/students")
  }

  const groupedMarks = new Map<string, {
    offeringId: string
    subjectCode: string
    subjectTitle: string
    term: string
    academicYear: string
    semester: string
    year: string
    evaluationPattern: string
    courseType: string
    marks: Array<{
      markId: string
      assessmentId: string
      assessmentName: string
      assessmentCode: string
      maxMarks: number
      weightage: number
      marks: number
    }>
  }>()

  for (const mark of student.marks) {
    const offering = mark.assessment.offering
    if (!offering) continue

    const existing = groupedMarks.get(offering.id) ?? {
      offeringId: offering.id,
      subjectCode: offering.subject.code,
      subjectTitle: offering.subject.title,
      term: offering.term,
      academicYear: offering.academicYear,
      semester: offering.semester,
      year: offering.year,
      evaluationPattern: offering.evaluationPattern,
      courseType: offering.courseType,
      marks: [],
    }

    existing.marks.push({
      markId: mark.id,
      assessmentId: mark.assessmentId,
      assessmentName: mark.assessment.name,
      assessmentCode: mark.assessment.code,
      maxMarks: mark.assessment.maxMarks,
      weightage: mark.assessment.weightage,
      marks: mark.marks,
    })

    groupedMarks.set(offering.id, existing)
  }

  const subjectGroups = [...groupedMarks.values()]
    .map((group) => ({
      ...group,
      marks: group.marks.sort((left, right) => left.assessmentCode.localeCompare(right.assessmentCode)),
    }))
    .sort((left, right) => {
      return (
        right.academicYear.localeCompare(left.academicYear) ||
        right.term.localeCompare(left.term) ||
        left.subjectCode.localeCompare(right.subjectCode)
      )
    })

  return (
    <StudentRecordClient
      student={{
        id: student.id,
        rollNo: student.rollNo,
        name: student.name,
        section: {
          id: student.section.id,
          name: student.section.name,
        },
      }}
      sections={sections}
      subjectGroups={subjectGroups}
    />
  )
}
