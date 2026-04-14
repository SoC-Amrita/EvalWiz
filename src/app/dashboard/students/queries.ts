import prisma from "@/lib/db"
import { buildScopedStudentWhere, type CourseWorkspace, type WorkspaceRoleView } from "@/lib/course-workspace"

const STUDENT_PAGE_SIZE = 50

type WorkspaceUser = {
  id: string
  role: string
  isAdmin: boolean
}

export type StudentRosterPage<TStudent> = {
  students: TStudent[]
  totalCount: number
  page: number
  pageCount: number
  pageSize: number
}

function normalizeRequestedPage(page: number) {
  if (!Number.isFinite(page) || page < 1) {
    return 1
  }

  return Math.floor(page)
}

function buildStudentSearchClause(query: string) {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return undefined
  }

  return {
    OR: [
      {
        rollNo: {
          contains: trimmedQuery,
          mode: "insensitive" as const,
        },
      },
      {
        name: {
          contains: trimmedQuery,
          mode: "insensitive" as const,
        },
      },
    ],
  }
}

function toStudentRosterPage<TStudent>(input: {
  students: TStudent[]
  totalCount: number
  requestedPage: number
}) {
  const pageCount = Math.max(1, Math.ceil(input.totalCount / STUDENT_PAGE_SIZE))
  const page = Math.min(normalizeRequestedPage(input.requestedPage), pageCount)

  return {
    students: input.students,
    totalCount: input.totalCount,
    page,
    pageCount,
    pageSize: STUDENT_PAGE_SIZE,
  }
}

export async function getAdminStudentsPage(input: {
  query: string
  page: number
}) {
  const searchClause = buildStudentSearchClause(input.query)
  const where = searchClause ? { ...searchClause } : undefined
  const totalCount = await prisma.student.count({ where })
  const pageCount = Math.max(1, Math.ceil(totalCount / STUDENT_PAGE_SIZE))
  const page = Math.min(normalizeRequestedPage(input.page), pageCount)
  const skip = (page - 1) * STUDENT_PAGE_SIZE

  const students = await prisma.student.findMany({
    where,
    include: {
      section: {
        select: {
          id: true,
          name: true,
          semester: true,
          programCode: true,
          sectionCode: true,
        },
      },
    },
    orderBy: [{ section: { name: "asc" } }, { rollNo: "asc" }],
    skip,
    take: STUDENT_PAGE_SIZE,
  })

  return toStudentRosterPage({
    students,
    totalCount,
    requestedPage: page,
  })
}

export async function getWorkspaceStudentsPage(input: {
  user: WorkspaceUser
  workspace: CourseWorkspace
  roleView: WorkspaceRoleView
  query: string
  page: number
  sectionId: string | null
  assessmentIds: string[]
}) {
  const scopedWhere = await buildScopedStudentWhere(input.user, input.workspace, input.roleView)
  const searchClause = buildStudentSearchClause(input.query)

  const sectionScope =
    input.sectionId && input.sectionId !== "ALL"
      ? input.workspace.isElective
        ? {
            offeringEnrollments: {
              some: {
                offeringId: input.workspace.offeringId,
                sectionId: input.sectionId,
              },
            },
          }
        : {
            sectionId: input.sectionId,
          }
      : undefined

  const where = {
    ...scopedWhere,
    ...(sectionScope ?? {}),
    ...(searchClause ?? {}),
  }

  const totalCount = await prisma.student.count({ where })
  const pageCount = Math.max(1, Math.ceil(totalCount / STUDENT_PAGE_SIZE))
  const page = Math.min(normalizeRequestedPage(input.page), pageCount)
  const skip = (page - 1) * STUDENT_PAGE_SIZE

  const students = await prisma.student.findMany({
    where,
    include: {
      section: {
        select: {
          id: true,
          name: true,
          semester: true,
          programCode: true,
          sectionCode: true,
        },
      },
      marks: {
        where: { assessmentId: { in: input.assessmentIds } },
        select: {
          assessmentId: true,
          marks: true,
        },
      },
    },
    orderBy: [{ section: { name: "asc" } }, { rollNo: "asc" }],
    skip,
    take: STUDENT_PAGE_SIZE,
  })

  return toStudentRosterPage({
    students,
    totalCount,
    requestedPage: page,
  })
}

export { STUDENT_PAGE_SIZE }
