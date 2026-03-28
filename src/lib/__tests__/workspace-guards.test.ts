import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.fn()
const getActiveWorkspaceStateMock = vi.fn()
const getAllowedSectionIdsForWorkspaceMock = vi.fn()
const canManageUsersMock = vi.fn()

vi.mock("@/auth", () => ({
  auth: authMock,
}))

vi.mock("@/lib/course-workspace", () => ({
  getActiveWorkspaceState: getActiveWorkspaceStateMock,
  getAllowedSectionIdsForWorkspace: getAllowedSectionIdsForWorkspaceMock,
}))

vi.mock("@/lib/user-roles", () => ({
  canManageUsers: canManageUsersMock,
}))

describe("workspace-guards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires an authenticated user for workspace state", async () => {
    authMock.mockResolvedValue(null)

    const { requireAuthenticatedWorkspaceState } = await import("@/lib/workspace-guards")

    await expect(requireAuthenticatedWorkspaceState()).rejects.toThrow("Unauthorized")
  })

  it("returns the authenticated workspace state", async () => {
    const user = { id: "u1", isAdmin: false, role: "FACULTY" }
    authMock.mockResolvedValue({ user })
    getActiveWorkspaceStateMock.mockResolvedValue({
      activeWorkspace: { offeringId: "off-1" },
      activeRoleView: "mentor",
      workspaces: [],
    })

    const { requireAuthenticatedWorkspaceState } = await import("@/lib/workspace-guards")
    const result = await requireAuthenticatedWorkspaceState()

    expect(result).toMatchObject({
      user,
      activeWorkspace: { offeringId: "off-1" },
      activeRoleView: "mentor",
    })
  })

  it("blocks faculty from manager-only workspace access", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", isAdmin: false, role: "FACULTY" } })
    getActiveWorkspaceStateMock.mockResolvedValue({
      activeWorkspace: { offeringId: "off-1" },
      activeRoleView: "faculty",
      workspaces: [],
    })

    const { requireWorkspaceManagerState } = await import("@/lib/workspace-guards")

    await expect(requireWorkspaceManagerState()).rejects.toThrow("Unauthorized")
  })

  it("returns allowed section ids as a set", async () => {
    const user = { id: "u1", isAdmin: false, role: "FACULTY" }
    const activeWorkspace = { offeringId: "off-1" }
    authMock.mockResolvedValue({ user })
    getActiveWorkspaceStateMock.mockResolvedValue({
      activeWorkspace,
      activeRoleView: "mentor",
      workspaces: [],
    })
    getAllowedSectionIdsForWorkspaceMock.mockResolvedValue(["s1", "s2", "s2"])

    const { requireAllowedSectionAccess } = await import("@/lib/workspace-guards")
    const result = await requireAllowedSectionAccess()

    expect(result.allowedSectionIds).toEqual(new Set(["s1", "s2"]))
    expect(getAllowedSectionIdsForWorkspaceMock).toHaveBeenCalledWith(user, activeWorkspace, "mentor")
  })

  it("requires a manageable admin user", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", isAdmin: true, role: "ADMIN" } })
    canManageUsersMock.mockReturnValue(false)

    const { requireAdminUser } = await import("@/lib/workspace-guards")

    await expect(requireAdminUser()).rejects.toThrow("Unauthorized")
  })

  it("returns the admin user when authorized", async () => {
    const user = { id: "u1", isAdmin: true, role: "ADMIN" }
    authMock.mockResolvedValue({ user })
    canManageUsersMock.mockReturnValue(true)

    const { requireAdminUser } = await import("@/lib/workspace-guards")

    await expect(requireAdminUser()).resolves.toEqual(user)
  })

  it("requires a real workspace offering id", async () => {
    const { requireRealWorkspace } = await import("@/lib/workspace-guards")

    expect(() => requireRealWorkspace({ offeringId: "" })).toThrow(
      "Select an active course offering before continuing"
    )
    expect(() => requireRealWorkspace({ offeringId: "off-1" })).not.toThrow()
  })
})
