import { beforeEach, describe, expect, it, vi } from "vitest"

const revalidatePathMock = vi.fn()
const supabaseAdminCreateUserMock = vi.fn()
const buildNameFieldsMock = vi.fn()
const requireAdminUserMock = vi.fn()
const requireAuthenticatedWorkspaceStateMock = vi.fn()
const requireRealWorkspaceMock = vi.fn()
const requireWorkspaceManagerStateMock = vi.fn()

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  faculty: {
    create: vi.fn(),
    update: vi.fn(),
  },
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
  $transaction: vi.fn(),
}

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn().mockReturnValue({
    auth: {
      admin: {
        createUser: supabaseAdminCreateUserMock,
      },
    },
  }),
}))

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock("@/lib/user-names", () => ({
  buildNameFields: buildNameFieldsMock,
}))

vi.mock("@/lib/workspace-guards", () => ({
  requireAdminUser: requireAdminUserMock,
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
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", role: "FACULTY", isAdmin: true })
    buildNameFieldsMock.mockReturnValue({
      title: "Dr.",
      firstName: "Anisha",
      lastName: "Radhakrishnan",
      name: "Dr. Anisha Radhakrishnan",
    })
    supabaseAdminCreateUserMock.mockResolvedValue({ data: { user: { id: "supa-new-1" } }, error: null })
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        user: { create: prismaMock.user.create, update: prismaMock.user.update },
        faculty: { create: prismaMock.faculty.create, update: prismaMock.faculty.update },
      })
    )
    requireWorkspaceManagerStateMock.mockResolvedValue({
      activeWorkspace: { offeringId: "off-1", isElective: false },
    })
    requireAuthenticatedWorkspaceStateMock.mockResolvedValue({
      activeWorkspace: { offeringId: "off-1", isElective: true },
      activeRoleView: "mentor",
    })
  })

  it("creates faculty accounts with the provided password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({ id: "user-1" })

    const { createFaculty } = await import("@/app/dashboard/sections/actions")

    await expect(
      createFaculty({
        name: "Dr. Anisha Radhakrishnan",
        email: "fac1@amrita.edu",
        password: "strongpass1",
      })
    ).resolves.toEqual({ success: true })

    expect(supabaseAdminCreateUserMock).toHaveBeenCalledWith({
      email: "fac1@amrita.edu",
      password: "strongpass1",
      email_confirm: true,
    })
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        supabaseId: "supa-new-1",
        title: "Dr.",
        firstName: "Anisha",
        lastName: "Radhakrishnan",
        name: "Dr. Anisha Radhakrishnan",
        email: "fac1@amrita.edu",
        role: "FACULTY",
      },
    })
    expect(prismaMock.faculty.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        name: "Dr. Anisha Radhakrishnan",
      },
    })
  })

  it("rejects faculty creation when no password is provided", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const { createFaculty } = await import("@/app/dashboard/sections/actions")

    await expect(
      createFaculty({
        name: "Dr. Anisha Radhakrishnan",
        email: "fac1@amrita.edu",
      })
    ).rejects.toThrow("Password is required")
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
