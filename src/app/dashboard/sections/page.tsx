import { auth } from "@/auth"
import { buildScopedSectionWhere, getActiveWorkspaceState } from "@/lib/course-workspace"
import prisma from "@/lib/db"
import { redirect } from "next/navigation"
import { SectionsClient } from "./client"
import { canManageUsers } from "@/lib/user-roles"

export default async function SectionsPage() {
  const session = await auth()
  const user = session?.user
  if (!user) {
    redirect("/dashboard")
  }

  const { activeWorkspace, activeRoleView } = await getActiveWorkspaceState(user)
  if (activeRoleView === "faculty" && !activeWorkspace.isElective) {
    redirect("/dashboard")
  }

  const isAdmin = canManageUsers(user)
  const sectionWhere = await buildScopedSectionWhere(user, activeWorkspace, activeRoleView)

  const sections = await prisma.courseOfferingClass.findMany({
    where: {
      offeringId: activeWorkspace.offeringId,
      section: sectionWhere,
    },
    include: {
      section: {
        include: {
          _count: {
            select: { students: true },
          },
        },
      },
      faculty: {
        include: {
          user: true
        }
      },
    },
    orderBy: { section: { name: "asc" } }
  })

  const electiveEnrollmentCounts = activeWorkspace.isElective
    ? await prisma.courseOfferingEnrollment.findMany({
        where: {
          offeringId: activeWorkspace.offeringId,
          sectionId: { in: sections.map((assignment) => assignment.section.id) },
        },
        select: { sectionId: true },
      }).then((enrollments) =>
        enrollments.reduce<Record<string, number>>((accumulator, enrollment) => {
          accumulator[enrollment.sectionId] = (accumulator[enrollment.sectionId] ?? 0) + 1
          return accumulator
        }, {})
      )
    : {}

  const facultyMembers = activeWorkspace.isElective
    ? []
    : await prisma.faculty.findMany({
        include: {
          user: true,
          _count: {
            select: { offeringAssignments: true }
          }
        },
        orderBy: { user: { name: "asc" } }
      })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {activeWorkspace.isElective ? "Elective Class & Roster" : "Sections & Faculty"}
        </h1>
        <p className="text-slate-500">
          {activeWorkspace.isElective
            ? `Review the single elective class attached to ${activeWorkspace.subjectCode} and manage its roster. The mentor is the default faculty for this offering.`
            : `Review the reusable class roster attached to ${activeWorkspace.subjectCode} and set faculty ownership for this offering.`}
        </p>
      </div>
      <SectionsClient
        sections={sections.map((assignment) => ({
          id: assignment.section.id,
          name: assignment.section.name,
          facultyId: assignment.facultyId,
          _count: {
            students: activeWorkspace.isElective
              ? (electiveEnrollmentCounts[assignment.section.id] ?? 0)
              : assignment.section._count.students,
          },
        }))}
        facultyMembers={facultyMembers}
        canManageUsers={isAdmin}
        workspaceLabel={`${activeWorkspace.subjectCode} · ${activeWorkspace.subjectTitle}`}
        isElective={activeWorkspace.isElective}
      />
    </div>
  )
}
