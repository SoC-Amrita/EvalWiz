import { auth } from "@/auth"
import { buildScopedSectionWhere, getActiveWorkspaceState } from "@/lib/course-workspace"
import prisma from "@/lib/db"
import { formatCompactSectionName, formatWorkspaceFullLabel } from "@/lib/workspace-labels"
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
          {activeWorkspace.isElective ? "Elective Class & Roster" : "Section Allocation"}
        </h1>
        <p className="text-slate-500">
          {activeWorkspace.isElective
            ? `Manage the single elective class and roster for ${formatWorkspaceFullLabel(activeWorkspace)}. The mentor remains the default faculty for this offering.`
            : `Assign section coordinators for ${formatWorkspaceFullLabel(activeWorkspace)}.`}
        </p>
      </div>
      <SectionsClient
        sections={sections.map((assignment) => ({
          id: assignment.section.id,
          name: assignment.section.name,
          compactName: activeWorkspace.isElective
            ? assignment.section.name
            : formatCompactSectionName(assignment.section.name, assignment.section.sectionCode),
          facultyId: assignment.facultyId,
          _count: {
            students: activeWorkspace.isElective
              ? (electiveEnrollmentCounts[assignment.section.id] ?? 0)
              : assignment.section._count.students,
          },
        }))}
        facultyMembers={facultyMembers}
        canManageUsers={isAdmin}
        workspaceLabel={formatWorkspaceFullLabel(activeWorkspace)}
        isElective={activeWorkspace.isElective}
      />
    </div>
  )
}
