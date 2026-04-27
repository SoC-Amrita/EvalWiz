import prisma from "@/lib/db"
import { requireAdminUser } from "@/lib/workspace-guards"

export async function getAcademicSetupData() {
  await requireAdminUser()

  const [subjects, classes, facultyMembers, offerings] = await Promise.all([
    prisma.subject.findMany({
      include: {
        _count: {
          select: { offerings: true },
        },
      },
      orderBy: [
        { isActive: "desc" },
        { code: "asc" },
      ],
    }),
    prisma.section.findMany({
      where: {
        isElectiveClass: false,
      },
      include: {
        _count: {
          select: {
            students: true,
            offeringAssignments: true,
          },
        },
      },
      orderBy: [
        { isActive: "desc" },
        { name: "asc" },
      ],
    }),
    prisma.faculty.findMany({
      include: {
        user: true,
        _count: {
          select: { offeringAssignments: true },
        },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.courseOffering.findMany({
      include: {
        subject: true,
        classAssignments: {
          include: {
            section: true,
            faculty: {
              include: {
                user: true,
              },
            },
          },
          orderBy: { section: { name: "asc" } },
        },
        mentorAssignments: {
          include: {
            user: true,
          },
          orderBy: { user: { name: "asc" } },
        },
      },
      orderBy: [
        { isActive: "desc" },
        { academicYear: "desc" },
        { term: "desc" },
        { subject: { code: "asc" } },
      ],
    }),
  ])

  return {
    subjects,
    classes,
    facultyMembers,
    mentors: facultyMembers.map((mentor) => ({
      id: mentor.user.id,
      name: mentor.user.name,
      email: mentor.user.email,
      currentTeachingAssignments: mentor._count.offeringAssignments,
    })),
    offerings,
  }
}
