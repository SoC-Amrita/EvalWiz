import { cookies } from "next/headers"

import prisma from "@/lib/db"
import { inferSectionCodeFromLabel } from "@/lib/roll-number"
import { isAdminRole } from "@/lib/user-roles"

export type WorkspaceRoleView = "administrator" | "mentor" | "faculty"

type WorkspaceUser = {
  id: string
  role: string
  isAdmin: boolean
}

export type CourseWorkspace = {
  key: string
  offeringId: string
  subjectId: string
  subjectCode: string
  subjectTitle: string
  program: string
  term: string
  academicYear: string
  semester: string
  year: string
  evaluationPattern: string
  courseType: string
  isElective: boolean
  isActive: boolean
  sectionIds: string[]
  sectionNames: string[]
  sectionCodes: string[]
  batchLabel: string
  availableRoleViews: WorkspaceRoleView[]
}

const ACTIVE_COURSE_COOKIE = "active-course-key"
const ACTIVE_ROLE_COOKIE = "active-role-view"
const ADMIN_CONSOLE_MODE_COOKIE = "admin-console-mode"
const EMPTY_WORKSPACE_KEY = "__empty_workspace__"

function addRoleView(workspace: CourseWorkspace, roleView: WorkspaceRoleView) {
  if (!workspace.availableRoleViews.includes(roleView)) {
    workspace.availableRoleViews.push(roleView)
  }
}

function buildWorkspaceKey(offeringId: string) {
  return offeringId
}

function buildBatchLabel(batchYears: string[]) {
  if (batchYears.length === 0) return ""
  if (batchYears.length === 1) return `${batchYears[0]} Batch`
  return `${batchYears.join(" / ")} Batches`
}

function createWorkspaceFromOffering(offering: {
  id: string
  term: string
  academicYear: string
  semester: string
  year: string
  evaluationPattern: string
  courseType: string
  isElective: boolean
  isActive: boolean
  subject: {
    id: string
    code: string
    title: string
    program: string
  }
  classAssignments: Array<{
    section: {
      id: string
      name: string
      admissionYear: string | null
      sectionCode: string | null
    }
  }>
}): CourseWorkspace {
  const sectionCodes = [...new Set(
    offering.classAssignments
      .map((assignment) => assignment.section.sectionCode ?? inferSectionCodeFromLabel(assignment.section.name))
      .filter((value): value is string => Boolean(value))
  )].sort((left, right) => left.localeCompare(right))
  const batchYears = [...new Set(
    offering.classAssignments
      .map((assignment) => assignment.section.admissionYear?.trim() ?? "")
      .filter(Boolean)
  )].sort((left, right) => right.localeCompare(left))

  return {
    key: buildWorkspaceKey(offering.id),
    offeringId: offering.id,
    subjectId: offering.subject.id,
    subjectCode: offering.subject.code,
    subjectTitle: offering.subject.title,
    program: offering.subject.program,
    term: offering.term,
    academicYear: offering.academicYear,
    semester: offering.semester,
    year: offering.year,
    evaluationPattern: offering.evaluationPattern,
    courseType: offering.courseType,
    isElective: offering.isElective,
    isActive: offering.isActive,
    sectionIds: offering.classAssignments.map((assignment) => assignment.section.id),
    sectionNames: offering.classAssignments.map((assignment) => assignment.section.name),
    sectionCodes,
    batchLabel: buildBatchLabel(batchYears),
    availableRoleViews: [],
  }
}

function getDefaultRoleView(user: WorkspaceUser, availableRoleViews: WorkspaceRoleView[]) {
  if (user.isAdmin && availableRoleViews.includes("administrator")) return "administrator"
  if (availableRoleViews.includes("mentor")) return "mentor"
  if (availableRoleViews.includes("faculty")) return "faculty"
  return availableRoleViews[0] ?? "faculty"
}

function buildFallbackWorkspace(): CourseWorkspace {
  return {
    key: EMPTY_WORKSPACE_KEY,
    offeringId: "",
    subjectId: "",
    subjectCode: "No active offering",
    subjectTitle: "Create or activate a course offering to unlock course-specific tools.",
    program: "",
    term: "",
    academicYear: "",
    semester: "",
    year: "",
    evaluationPattern: "",
    courseType: "",
    isElective: false,
    isActive: false,
    sectionIds: [],
    sectionNames: [],
    sectionCodes: [],
    batchLabel: "",
    availableRoleViews: [],
  }
}

export function buildWorkspaceSectionWhere(workspace: CourseWorkspace) {
  return {
    id: { in: workspace.sectionIds.length > 0 ? workspace.sectionIds : ["__no_section__"] },
  }
}

export async function getAllowedSectionIdsForWorkspace(user: WorkspaceUser, workspace: CourseWorkspace, roleView: WorkspaceRoleView) {
  if (!workspace.offeringId) {
    return []
  }

  if (roleView !== "faculty") {
    return workspace.sectionIds
  }

  const assignments = await prisma.courseOfferingClass.findMany({
    where: {
      offeringId: workspace.offeringId,
      faculty: { userId: user.id },
    },
    select: { sectionId: true },
  })

  return assignments.map((assignment) => assignment.sectionId)
}

export async function buildScopedSectionWhere(user: WorkspaceUser, workspace: CourseWorkspace, roleView: WorkspaceRoleView) {
  const allowedSectionIds = await getAllowedSectionIdsForWorkspace(user, workspace, roleView)
  return {
    id: { in: allowedSectionIds.length > 0 ? allowedSectionIds : ["__no_section__"] },
  }
}

export async function listAccessibleCourseWorkspaces(user: WorkspaceUser): Promise<CourseWorkspace[]> {
  const [adminOfferings, mentorOfferings, facultyOfferings] = await Promise.all([
    isAdminRole(user)
      ? prisma.courseOffering.findMany({
          where: {
            isActive: true,
          },
          include: {
            subject: true,
            classAssignments: {
              include: {
                section: true,
              },
            },
          },
          orderBy: [
            { isActive: "desc" },
            { academicYear: "desc" },
            { term: "desc" },
            { subject: { code: "asc" } },
          ],
        })
      : Promise.resolve([]),
    prisma.courseOffering.findMany({
      where: {
        isActive: true,
        mentorAssignments: {
          some: { userId: user.id },
        },
      },
      include: {
        subject: true,
        classAssignments: {
          include: {
            section: true,
          },
        },
      },
      orderBy: [
        { isActive: "desc" },
        { academicYear: "desc" },
        { term: "desc" },
        { subject: { code: "asc" } },
      ],
    }),
    prisma.courseOffering.findMany({
      where: {
        isActive: true,
        classAssignments: {
          some: {
            faculty: { userId: user.id },
          },
        },
      },
      include: {
        subject: true,
        classAssignments: {
          include: {
            section: true,
          },
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

  const workspaces = new Map<string, CourseWorkspace>()

  for (const offering of adminOfferings) {
    const workspace = workspaces.get(offering.id) ?? createWorkspaceFromOffering(offering)
    addRoleView(workspace, "mentor")
    workspaces.set(offering.id, workspace)
  }

  for (const offering of mentorOfferings) {
    const workspace = workspaces.get(offering.id) ?? createWorkspaceFromOffering(offering)
    addRoleView(workspace, "mentor")
    workspaces.set(offering.id, workspace)
  }

  for (const offering of facultyOfferings) {
    const workspace = workspaces.get(offering.id) ?? createWorkspaceFromOffering(offering)
    addRoleView(workspace, "faculty")
    workspaces.set(offering.id, workspace)
  }

  if (workspaces.size === 0) {
    const fallback = buildFallbackWorkspace()
    if (user.isAdmin) addRoleView(fallback, "mentor")
    if (fallback.availableRoleViews.length === 0) addRoleView(fallback, "faculty")
    workspaces.set(fallback.key, fallback)
  }

  return [...workspaces.values()]
    .sort((left, right) => {
      return (
        Number(right.isActive) - Number(left.isActive) ||
        right.academicYear.localeCompare(left.academicYear) ||
        right.term.localeCompare(left.term) ||
        left.subjectCode.localeCompare(right.subjectCode)
      )
    })
}

export async function getActiveWorkspaceState(user: WorkspaceUser) {
  const workspaces = await listAccessibleCourseWorkspaces(user)
  const cookieStore = await cookies()
  const requestedCourseKey = cookieStore.get(ACTIVE_COURSE_COOKIE)?.value
  const requestedRoleView = cookieStore.get(ACTIVE_ROLE_COOKIE)?.value as WorkspaceRoleView | undefined
  const requestedAdminConsoleMode = cookieStore.get(ADMIN_CONSOLE_MODE_COOKIE)?.value

  const activeWorkspace = workspaces.find((workspace) => workspace.key === requestedCourseKey) ?? workspaces[0]
  const isAdminConsole = user.isAdmin && requestedAdminConsoleMode !== "workspace"
  const activeRoleView = isAdminConsole
    ? "administrator"
    : requestedRoleView && activeWorkspace.availableRoleViews.includes(requestedRoleView)
      ? requestedRoleView
      : getDefaultRoleView(user, activeWorkspace.availableRoleViews)

  return {
    workspaces,
    activeWorkspace,
    activeRoleView,
    isAdminConsole,
    needsAdminModeChoice: user.isAdmin && requestedAdminConsoleMode !== "admin" && requestedAdminConsoleMode !== "workspace",
  }
}

export async function setActiveWorkspaceCookies(courseKey: string, roleView: WorkspaceRoleView) {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_COURSE_COOKIE, courseKey, { path: "/", sameSite: "lax" })
  cookieStore.set(ACTIVE_ROLE_COOKIE, roleView, { path: "/", sameSite: "lax" })
  if (roleView !== "administrator") {
    cookieStore.set(ADMIN_CONSOLE_MODE_COOKIE, "workspace", { path: "/", sameSite: "lax" })
  }
}

export async function setAdminConsoleModeCookie(mode: "admin" | "workspace") {
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_CONSOLE_MODE_COOKIE, mode, { path: "/", sameSite: "lax" })
}

export function hasRealWorkspace(workspace: CourseWorkspace) {
  return Boolean(workspace.offeringId)
}

export function getRoleViewLabel(roleView: WorkspaceRoleView) {
  switch (roleView) {
    case "administrator":
      return "Administrator"
    case "mentor":
      return "Mentor"
    case "faculty":
      return "Faculty"
  }
}
