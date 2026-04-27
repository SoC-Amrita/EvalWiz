import { cookies } from "next/headers"
import { cache } from "react"

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
const EMPTY_SECTION_IDS = ["__no_section__"]
const EMPTY_STUDENT_IDS = ["__no_student__"]
const WORKSPACE_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: true,
}

const workspaceOfferingSelect = {
  id: true,
  term: true,
  academicYear: true,
  semester: true,
  year: true,
  evaluationPattern: true,
  courseType: true,
  isElective: true,
  isActive: true,
  subject: {
    select: {
      id: true,
      code: true,
      title: true,
      program: true,
    },
  },
  classAssignments: {
    select: {
      section: {
        select: {
          id: true,
          name: true,
          admissionYear: true,
          sectionCode: true,
        },
      },
    },
  },
} as const

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

const getFacultySectionIdsForWorkspaceCached = cache(async (userId: string, offeringId: string) => {
  const assignments = await prisma.courseOfferingClass.findMany({
    where: {
      offeringId,
      faculty: { userId },
    },
    select: { sectionId: true },
  })

  return assignments.map((assignment) => assignment.sectionId)
})

export async function getAllowedStudentIdsForWorkspace(user: WorkspaceUser, workspace: CourseWorkspace, roleView: WorkspaceRoleView) {
  if (!workspace.offeringId) {
    return []
  }

  const allowedSectionIds = await getAllowedSectionIdsForWorkspace(user, workspace, roleView)
  const scopedSectionIds = allowedSectionIds.length > 0 ? allowedSectionIds : EMPTY_SECTION_IDS

  if (!workspace.isElective) {
    const students = await prisma.student.findMany({
      where: {
        sectionId: { in: scopedSectionIds },
      },
      select: { id: true },
    })

    return students.map((student) => student.id)
  }

  const enrollments = await prisma.courseOfferingEnrollment.findMany({
    where: {
      offeringId: workspace.offeringId,
      sectionId: { in: scopedSectionIds },
    },
    select: { studentId: true },
  })

  return enrollments.map((enrollment) => enrollment.studentId)
}

export async function getAllowedSectionIdsForWorkspace(user: WorkspaceUser, workspace: CourseWorkspace, roleView: WorkspaceRoleView) {
  if (!workspace.offeringId) {
    return []
  }

  if (roleView !== "faculty") {
    return workspace.sectionIds
  }

  return getFacultySectionIdsForWorkspaceCached(user.id, workspace.offeringId)
}

export async function buildScopedSectionWhere(user: WorkspaceUser, workspace: CourseWorkspace, roleView: WorkspaceRoleView) {
  const allowedSectionIds = await getAllowedSectionIdsForWorkspace(user, workspace, roleView)
  return {
    id: { in: allowedSectionIds.length > 0 ? allowedSectionIds : ["__no_section__"] },
  }
}

export async function buildScopedStudentWhere(
  user: WorkspaceUser,
  workspace: CourseWorkspace,
  roleView: WorkspaceRoleView,
  options?: {
    excludeFromAnalytics?: boolean
  }
) {
  if (!workspace.offeringId) {
    return {
      id: { in: EMPTY_STUDENT_IDS },
      ...(options?.excludeFromAnalytics ? { excludeFromAnalytics: false } : {}),
    }
  }

  const allowedSectionIds = await getAllowedSectionIdsForWorkspace(user, workspace, roleView)
  const scopedSectionIds = allowedSectionIds.length > 0 ? allowedSectionIds : EMPTY_SECTION_IDS

  return {
    ...(workspace.isElective
      ? {
          offeringEnrollments: {
            some: {
              offeringId: workspace.offeringId,
              sectionId: { in: scopedSectionIds },
            },
          },
        }
      : {
          sectionId: { in: scopedSectionIds },
        }),
    ...(options?.excludeFromAnalytics ? { excludeFromAnalytics: false } : {}),
  }
}

const listAccessibleCourseWorkspacesCached = cache(
  async (userId: string, role: string, isAdmin: boolean): Promise<CourseWorkspace[]> => {
    const user = { id: userId, role, isAdmin }
  const [adminOfferings, mentorOfferings, facultyOfferings] = await Promise.all([
    isAdminRole(user)
      ? prisma.courseOffering.findMany({
          where: {
            isActive: true,
          },
          select: workspaceOfferingSelect,
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
      select: workspaceOfferingSelect,
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
      select: workspaceOfferingSelect,
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
})

export async function listAccessibleCourseWorkspaces(user: WorkspaceUser): Promise<CourseWorkspace[]> {
  return listAccessibleCourseWorkspacesCached(user.id, user.role, user.isAdmin)
}

const getWorkspaceCookiePreferences = cache(async () => {
  const cookieStore = await cookies()
  return {
    requestedCourseKey: cookieStore.get(ACTIVE_COURSE_COOKIE)?.value,
    requestedRoleView: cookieStore.get(ACTIVE_ROLE_COOKIE)?.value as WorkspaceRoleView | undefined,
    requestedAdminConsoleMode: cookieStore.get(ADMIN_CONSOLE_MODE_COOKIE)?.value,
  }
})

export async function getActiveWorkspaceState(user: WorkspaceUser) {
  const workspaces = await listAccessibleCourseWorkspaces(user)
  const { requestedCourseKey, requestedRoleView, requestedAdminConsoleMode } = await getWorkspaceCookiePreferences()

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
  cookieStore.set(ACTIVE_COURSE_COOKIE, courseKey, WORKSPACE_COOKIE_OPTIONS)
  cookieStore.set(ACTIVE_ROLE_COOKIE, roleView, WORKSPACE_COOKIE_OPTIONS)
  if (roleView !== "administrator") {
    cookieStore.set(ADMIN_CONSOLE_MODE_COOKIE, "workspace", WORKSPACE_COOKIE_OPTIONS)
  }
}

export async function setAdminConsoleModeCookie(mode: "admin" | "workspace") {
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_CONSOLE_MODE_COOKIE, mode, WORKSPACE_COOKIE_OPTIONS)
}

export { hasRealWorkspace, getRoleViewLabel } from "@/lib/workspace-labels"
