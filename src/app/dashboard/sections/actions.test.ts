import { beforeEach, describe, expect, it, vi } from "vitest"

const revalidatePathMock = vi.fn()
const requireAuthenticatedWorkspaceStateMock = vi.fn()
const requireRealWorkspaceMock = vi.fn()
const requireWorkspaceManagerStateMock = vi.fn()

const prismaMock = {
  courseOfferingClass: {
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  student: {
    findMany: vi.fn(),
  },
  courseOfferingEnrollment: {
    upsert: vi.fn(),
  },
}

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock("@/lib/workspace-guards", () => ({
  requireAuthenticatedWorkspaceState: requireAuthenticatedWorkspaceStateMock,
  requireRealWorkspace: requireRealWorkspaceMock,
  requireWorkspaceManagerState: requireWorkspaceManagerStateMock,
}))

vi.mock("@/lib/db", () => ({
  default: prismaMock,
}))

describe("sections actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireWorkspaceManagerStateMock.mockResolvedValue({
      activeWorkspace: { offeringId: "off-1", isElective: false },
    })
    requireAuthenticatedWorkspaceStateMock.mockResolvedValue({
      activeWorkspace: { offeringId: "off-1", isElective: true },
      activeRoleView: "mentor",
    })
  })

  it("blocks section reassignment inside elective workspaces", async () => {
    requireWorkspaceManagerStateMock.mockResolvedValue({
      activeWorkspace: { offeringId: "off-1", isElective: true },
    })

    const { assignFacultyToSection } = await import("@/app/dashboard/sections/actions")

    await expect(assignFacultyToSection("sec-a", "fac-1")).rejects.toThrow(
      "Elective offerings use the mentor as the default faculty and do not support separate faculty reassignment"
    )
    expect(prismaMock.courseOfferingClass.update).not.toHaveBeenCalled()
  })

  it("uploads an elective roster and reports students missing from the registry", async () => {
    prismaMock.courseOfferingClass.findFirst.mockResolvedValue({ sectionId: "elective-sec" })
    prismaMock.student.findMany.mockResolvedValue([
      { id: "stu-1", rollNo: "CB.SC.U4CSE23001" },
    ])

    const { uploadElectiveRoster } = await import("@/app/dashboard/sections/actions")

    const result = await uploadElectiveRoster([
      "cb.sc.u4cse23001",
      "CB.SC.U4CSE23002",
    ])

    expect(prismaMock.courseOfferingEnrollment.upsert).toHaveBeenCalledWith({
      where: {
        offeringId_studentId: {
          offeringId: "off-1",
          studentId: "stu-1",
        },
      },
      update: {
        sectionId: "elective-sec",
      },
      create: {
        offeringId: "off-1",
        studentId: "stu-1",
        sectionId: "elective-sec",
      },
    })
    expect(result).toEqual({
      success: true,
      enrolledCount: 1,
      missingRollNumbers: ["CB.SC.U4CSE23002"],
    })
  })

  it("allows only mentors to upload elective rosters", async () => {
    requireAuthenticatedWorkspaceStateMock.mockResolvedValue({
      activeWorkspace: { offeringId: "off-1", isElective: true },
      activeRoleView: "faculty",
    })

    const { uploadElectiveRoster } = await import("@/app/dashboard/sections/actions")

    await expect(uploadElectiveRoster(["CB.SC.U4CSE23001"])).rejects.toThrow(
      "Only mentors can upload elective rosters"
    )
    expect(prismaMock.courseOfferingEnrollment.upsert).not.toHaveBeenCalled()
  })
})
