import { beforeEach, describe, expect, it, vi } from "vitest"

const cookiesMock = vi.fn()
const inferSectionCodeFromLabelMock = vi.fn()
const isAdminRoleMock = vi.fn()

const prismaMock = {
  courseOffering: { findMany: vi.fn() },
  courseOfferingClass: { findMany: vi.fn() },
  courseOfferingEnrollment: { findMany: vi.fn() },
  student: { findMany: vi.fn() },
}

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}))

vi.mock("@/lib/db", () => ({
  default: prismaMock,
}))

vi.mock("@/lib/roll-number", () => ({
  inferSectionCodeFromLabel: inferSectionCodeFromLabelMock,
}))

vi.mock("@/lib/user-roles", () => ({
  isAdminRole: isAdminRoleMock,
}))

const mentorOffering = {
  id: "off-1",
  term: "Even / Winter",
  academicYear: "2025 - 2026",
  semester: "VI",
  year: "III",
  evaluationPattern: "70 - 30",
  courseType: "Theory",
  isElective: false,
  isActive: true,
  subject: {
    id: "sub-1",
    code: "23CSE311",
    title: "Software Engineering",
    program: "BTech CSE",
  },
  classAssignments: [
    {
      section: {
        id: "sec-a",
        name: "BTech CSE A (2023 Batch)",
        admissionYear: "2023",
        sectionCode: "A",
      },
    },
    {
      section: {
        id: "sec-b",
        name: "BTech CSE B (2023 Batch)",
        admissionYear: "2023",
        sectionCode: "B",
      },
    },
  ],
}

describe("course-workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.courseOffering.findMany.mockReset()
    prismaMock.courseOfferingClass.findMany.mockReset()
    prismaMock.courseOfferingEnrollment.findMany.mockReset()
    prismaMock.student.findMany.mockReset()
    cookiesMock.mockReset()
    inferSectionCodeFromLabelMock.mockReset()
    isAdminRoleMock.mockReset()
    inferSectionCodeFromLabelMock.mockImplementation((label: string) => {
      const match = label.match(/\b([A-H])\b/i)
      return match?.[1]?.toUpperCase() ?? null
    })
    isAdminRoleMock.mockImplementation((user: { isAdmin: boolean }) => user.isAdmin)
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
      set: vi.fn(),
    })
  })

  it("returns all workspace section ids for mentor-style access", async () => {
    const { getAllowedSectionIdsForWorkspace } = await import("@/lib/course-workspace")

    const result = await getAllowedSectionIdsForWorkspace(
      { id: "u1", role: "FACULTY", isAdmin: false },
      {
        offeringId: "off-1",
        sectionIds: ["sec-a", "sec-b"],
      } as never,
      "mentor"
    )

    expect(result).toEqual(["sec-a", "sec-b"])
    expect(prismaMock.courseOfferingClass.findMany).not.toHaveBeenCalled()
  })

  it("queries faculty-specific section assignments", async () => {
    prismaMock.courseOfferingClass.findMany.mockResolvedValue([
      { sectionId: "sec-b" },
    ])

    const { getAllowedSectionIdsForWorkspace } = await import("@/lib/course-workspace")

    const result = await getAllowedSectionIdsForWorkspace(
      { id: "u1", role: "FACULTY", isAdmin: false },
      {
        offeringId: "off-1",
        sectionIds: ["sec-a", "sec-b"],
      } as never,
      "faculty"
    )

    expect(prismaMock.courseOfferingClass.findMany).toHaveBeenCalledWith({
      where: {
        offeringId: "off-1",
        faculty: { userId: "u1" },
      },
      select: { sectionId: true },
    })
    expect(result).toEqual(["sec-b"])
  })

  it("builds a scoped student filter for non-elective workspaces", async () => {
    prismaMock.student.findMany.mockResolvedValue([{ id: "stu-1" }, { id: "stu-2" }])

    const { buildScopedStudentWhere } = await import("@/lib/course-workspace")

    const result = await buildScopedStudentWhere(
      { id: "u1", role: "FACULTY", isAdmin: false },
      {
        offeringId: "off-1",
        isElective: false,
        sectionIds: ["sec-a", "sec-b"],
      } as never,
      "mentor"
    )

    expect(prismaMock.student.findMany).toHaveBeenCalledWith({
      where: {
        sectionId: { in: ["sec-a", "sec-b"] },
      },
      select: { id: true },
    })
    expect(result).toEqual({
      id: { in: ["stu-1", "stu-2"] },
    })
  })

  it("builds a scoped student filter for elective workspaces", async () => {
    prismaMock.courseOfferingEnrollment.findMany.mockResolvedValue([
      { studentId: "stu-5" },
      { studentId: "stu-6" },
    ])

    const { buildScopedStudentWhere } = await import("@/lib/course-workspace")

    const result = await buildScopedStudentWhere(
      { id: "u1", role: "FACULTY", isAdmin: false },
      {
        offeringId: "off-1",
        isElective: true,
        sectionIds: ["sec-elective"],
      } as never,
      "mentor"
    )

    expect(prismaMock.courseOfferingEnrollment.findMany).toHaveBeenCalledWith({
      where: {
        offeringId: "off-1",
        sectionId: { in: ["sec-elective"] },
      },
      select: { studentId: true },
    })
    expect(result).toEqual({
      id: { in: ["stu-5", "stu-6"] },
    })
  })

  it("builds a fallback workspace when the user has no offerings", async () => {
    prismaMock.courseOffering.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const { listAccessibleCourseWorkspaces } = await import("@/lib/course-workspace")

    const result = await listAccessibleCourseWorkspaces({
      id: "u1",
      role: "FACULTY",
      isAdmin: false,
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      offeringId: "",
      subjectCode: "No active offering",
      availableRoleViews: ["faculty"],
    })
  })

  it("merges mentor and faculty access onto the same offering", async () => {
    prismaMock.courseOffering.findMany
      .mockResolvedValueOnce([mentorOffering])
      .mockResolvedValueOnce([mentorOffering])

    const { listAccessibleCourseWorkspaces } = await import("@/lib/course-workspace")

    const [workspace] = await listAccessibleCourseWorkspaces({
      id: "u1",
      role: "FACULTY",
      isAdmin: false,
    })

    expect(prismaMock.courseOffering.findMany).toHaveBeenCalledTimes(2)
    expect(workspace.availableRoleViews).toEqual(["mentor", "faculty"])
    expect(workspace.sectionCodes).toEqual(["A", "B"])
    expect(workspace.batchLabel).toBe("2023 Batch")
  })

  it("prefers admin console mode for admins until workspace mode is chosen", async () => {
    prismaMock.courseOffering.findMany
      .mockResolvedValueOnce([mentorOffering])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const get = vi.fn((key: string) => {
      if (key === "admin-console-mode") return undefined
      if (key === "active-course-key") return { value: "off-1" }
      if (key === "active-role-view") return { value: "mentor" }
      return undefined
    })
    cookiesMock.mockResolvedValue({ get, set: vi.fn() })

    const { getActiveWorkspaceState } = await import("@/lib/course-workspace")

    const result = await getActiveWorkspaceState({
      id: "u1",
      role: "ADMIN",
      isAdmin: true,
    })

    expect(result.activeRoleView).toBe("administrator")
    expect(result.isAdminConsole).toBe(true)
    expect(result.needsAdminModeChoice).toBe(true)
  })

  it("writes the active workspace cookies and flips admin mode to workspace", async () => {
    const set = vi.fn()
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
      set,
    })

    const { setActiveWorkspaceCookies, setAdminConsoleModeCookie } = await import("@/lib/course-workspace")

    await setActiveWorkspaceCookies("off-1", "mentor")
    await setAdminConsoleModeCookie("admin")

    expect(set).toHaveBeenNthCalledWith(1, "active-course-key", "off-1", { path: "/", sameSite: "lax" })
    expect(set).toHaveBeenNthCalledWith(2, "active-role-view", "mentor", { path: "/", sameSite: "lax" })
    expect(set).toHaveBeenNthCalledWith(3, "admin-console-mode", "workspace", { path: "/", sameSite: "lax" })
    expect(set).toHaveBeenNthCalledWith(4, "admin-console-mode", "admin", { path: "/", sameSite: "lax" })
  })

  it("exposes simple workspace helpers", async () => {
    const { buildWorkspaceSectionWhere, getRoleViewLabel, hasRealWorkspace } = await import("@/lib/course-workspace")

    expect(buildWorkspaceSectionWhere({ sectionIds: ["sec-a"] } as never)).toEqual({
      id: { in: ["sec-a"] },
    })
    expect(buildWorkspaceSectionWhere({ sectionIds: [] } as never)).toEqual({
      id: { in: ["__no_section__"] },
    })
    expect(hasRealWorkspace({ offeringId: "off-1" } as never)).toBe(true)
    expect(hasRealWorkspace({ offeringId: "" } as never)).toBe(false)
    expect(getRoleViewLabel("administrator")).toBe("Administrator")
    expect(getRoleViewLabel("mentor")).toBe("Mentor")
    expect(getRoleViewLabel("faculty")).toBe("Faculty")
  })
})
