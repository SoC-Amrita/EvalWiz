import { getSessionUser } from "@/lib/session"
import prisma from "@/lib/db"
import { notFound, redirect } from "next/navigation"

import { getAcademicSetupData } from "../../data"
import { OfferingFormPage } from "../../offering-form"

export default async function EditOfferingPage({
  params,
}: {
  params: Promise<{ offeringId: string }>
}) {
  const user = await getSessionUser()
  if (!user?.isAdmin) {
    redirect("/dashboard")
  }

  const { offeringId } = await params
  const [{ subjects, classes, facultyMembers, mentors }, offering] = await Promise.all([
    getAcademicSetupData(),
    prisma.courseOffering.findUnique({
      where: { id: offeringId },
      include: {
        subject: {
          select: { id: true },
        },
        classAssignments: {
          select: {
            sectionId: true,
            facultyId: true,
            section: {
              select: {
                name: true,
              },
            },
          },
        },
        mentorAssignments: {
          select: {
            userId: true,
          },
        },
      },
    }),
  ])

  if (!offering) {
    notFound()
  }

  return (
    <OfferingFormPage
      mode="edit"
      subjects={subjects}
      classes={classes}
      facultyMembers={facultyMembers}
      mentors={mentors}
      offering={offering}
    />
  )
}
