import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdminUserMock = vi.fn()

const prismaMock = {
  subject: { findMany: vi.fn() },
  section: { findMany: vi.fn() },
  faculty: { findMany: vi.fn() },
  courseOffering: { findMany: vi.fn() },
}

vi.mock("@/lib/workspace-guards", () => ({
  requireAdminUser: requireAdminUserMock,
}))

vi.mock("@/lib/db", () => ({
  default: prismaMock,
}))

describe("academic setup data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", isAdmin: true })
    prismaMock.subject.findMany.mockResolvedValue([])
    prismaMock.section.findMany.mockResolvedValue([])
    prismaMock.faculty.findMany.mockResolvedValue([
      {
        user: {
          id: "user-1",
          name: "Dr. Mentor",
          email: "mentor@example.com",
        },
        _count: {
          offeringAssignments: 2,
        },
      },
    ])
    prismaMock.courseOffering.findMany.mockResolvedValue([])
  })

  it("requires an admin user before loading setup data", async () => {
    const { getAcademicSetupData } = await import("@/app/dashboard/academic-setup/data")

    await expect(getAcademicSetupData()).resolves.toMatchObject({
      subjects: [],
      classes: [],
      offerings: [],
      mentors: [
        {
          id: "user-1",
          name: "Dr. Mentor",
          email: "mentor@example.com",
          currentTeachingAssignments: 2,
        },
      ],
    })
    expect(requireAdminUserMock).toHaveBeenCalledTimes(1)
  })

  it("reuses the faculty query for mentor options", async () => {
    const { getAcademicSetupData } = await import("@/app/dashboard/academic-setup/data")

    await getAcademicSetupData()

    expect(prismaMock.faculty.findMany).toHaveBeenCalledTimes(1)
  })
})
