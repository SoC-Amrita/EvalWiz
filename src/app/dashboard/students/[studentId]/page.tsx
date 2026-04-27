import { auth } from "@/auth"
import prisma from "@/lib/db"
import { getActiveWorkspaceState } from "@/lib/course-workspace"
import { requireAllowedSectionAccess, requireRealWorkspace } from "@/lib/workspace-guards"
import { formatWorkspaceCode } from "@/lib/workspace-labels"
import { redirect } from "next/navigation"

import { StudentRecordClient } from "../record-client"
import { WorkspaceStudentRecordClient } from "../workspace-record-client"

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

  const { studentId } = await params
  const { activeRoleView } = await getActiveWorkspaceState(user)

  if (!user.isAdmin || activeRoleView !== "administrator") {
    const { activeWorkspace, activeRoleView: scopedRoleView, allowedSectionIds } = await requireAllowedSectionAccess()
    requireRealWorkspace(activeWorkspace)

    const allowedSectionIdList = [...allowedSectionIds]
    const [student, assessments, pendingDeletionRequest] = await Promise.all([
      activeWorkspace.isElective
        ? prisma.courseOfferingEnrollment.findFirst({
            where: {
              offeringId: activeWorkspace.offeringId,
              studentId,
              sectionId: { in: allowedSectionIdList.length > 0 ? allowedSectionIdList : ["__no_section__"] },
            },
            include: {
              student: {
                include: {
                  section: true,
                  marks: {
                    where: {
                      assessment: { offeringId: activeWorkspace.offeringId },
                    },
                    include: {
                      assessment: true,
                    },
                  },
                },
              },
            },
          }).then((enrollment) => enrollment?.student ?? null)
        : prisma.student.findFirst({
            where: {
              id: studentId,
              sectionId: { in: allowedSectionIdList.length > 0 ? allowedSectionIdList : ["__no_section__"] },
            },
            include: {
              section: true,
              marks: {
                where: {
                  assessment: { offeringId: activeWorkspace.offeringId },
                },
                include: {
                  assessment: true,
                },
              },
            },
          }),
      prisma.assessment.findMany({
        where: {
          offeringId: activeWorkspace.offeringId,
          isActive: true,
        },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.studentDeletionRequest.findFirst({
        where: {
          studentId,
          status: "PENDING",
        },
        select: { id: true },
      }),
    ])

    if (!student) {
      redirect("/dashboard/students")
    }

    const markByAssessmentId = new Map(student.marks.map((mark) => [mark.assessmentId, mark]))

    return (
      <WorkspaceStudentRecordClient
        student={{
          id: student.id,
          rollNo: student.rollNo,
          name: student.name,
          sectionName: student.section.name,
          excludeFromAnalytics: student.excludeFromAnalytics,
          pendingDeletionRequest: Boolean(pendingDeletionRequest),
        }}
        roleView={scopedRoleView}
        workspaceLabel={formatWorkspaceCode(activeWorkspace)}
        assessments={assessments.map((assessment) => {
          const existingMark = markByAssessmentId.get(assessment.id)
          return {
            assessmentId: assessment.id,
            assessmentName: assessment.name,
            assessmentCode: assessment.code,
            maxMarks: assessment.maxMarks,
            weightage: assessment.weightage,
            markId: existingMark?.id ?? null,
            marks: existingMark?.marks ?? null,
          }
        })}
      />
    )
  }

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
          excludeFromAnalytics: student.excludeFromAnalytics,
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
