import { beforeEach, describe, expect, it, vi } from "vitest"

const getSessionUserMock = vi.fn()
const getActiveWorkspaceStateMock = vi.fn()
const setActiveWorkspaceCookiesMock = vi.fn()
const setAdminConsoleModeCookieMock = vi.fn()
const enableAnalysisPreviewCookieMock = vi.fn()
const canManageUsersMock = vi.fn()

vi.mock("@/lib/session", () => ({
  getSessionUser: getSessionUserMock,
}))

vi.mock("@/lib/course-workspace", () => ({
  getActiveWorkspaceState: getActiveWorkspaceStateMock,
  setActiveWorkspaceCookies: setActiveWorkspaceCookiesMock,
  setAdminConsoleModeCookie: setAdminConsoleModeCookieMock,
}))

vi.mock("@/lib/analysis-preview-access", () => ({
  enableAnalysisPreviewCookie: enableAnalysisPreviewCookieMock,
}))

vi.mock("@/lib/user-roles", () => ({
  canManageUsers: canManageUsersMock,
}))

describe("workspace actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionUserMock.mockResolvedValue({
      id: "user-1",
      name: "Dr. Faculty",
      isAdmin: false,
    })
    getActiveWorkspaceStateMock.mockResolvedValue({
      workspaces: [
        {
          key: "course-1",
          availableRoleViews: ["faculty", "mentor"],
        },
      ],
    })
    canManageUsersMock.mockReturnValue(false)
  })

  it("requires authentication before activating a workspace", async () => {
    getSessionUserMock.mockResolvedValue(null)

    const { activateWorkspace } = await import("@/app/dashboard/workspace-actions")

    await expect(activateWorkspace("course-1", "faculty")).rejects.toThrow("Unauthorized")
    expect(setActiveWorkspaceCookiesMock).not.toHaveBeenCalled()
  })

  it("rejects unavailable role views for the selected workspace", async () => {
    const { activateWorkspace } = await import("@/app/dashboard/workspace-actions")

    await expect(activateWorkspace("course-1", "administrator")).rejects.toThrow(
      "That role is not available for the selected workspace"
    )
    expect(setActiveWorkspaceCookiesMock).not.toHaveBeenCalled()
  })

  it("sets active workspace cookies for an available role view", async () => {
    const { activateWorkspace } = await import("@/app/dashboard/workspace-actions")

    await expect(activateWorkspace("course-1", "mentor")).resolves.toEqual({ success: true })
    expect(setActiveWorkspaceCookiesMock).toHaveBeenCalledWith("course-1", "mentor")
  })

  it("allows only admins to switch admin console mode", async () => {
    const { setAdminConsoleMode } = await import("@/app/dashboard/workspace-actions")

    await expect(setAdminConsoleMode("admin")).rejects.toThrow("Unauthorized")
    expect(setAdminConsoleModeCookieMock).not.toHaveBeenCalled()

    canManageUsersMock.mockReturnValue(true)

    await expect(setAdminConsoleMode("admin")).resolves.toEqual({ success: true })
    expect(setAdminConsoleModeCookieMock).toHaveBeenCalledWith("admin")
  })

  it("requires authentication before enabling analysis preview access", async () => {
    getSessionUserMock.mockResolvedValue(null)

    const { enableAnalysisPreview } = await import("@/app/dashboard/workspace-actions")

    await expect(enableAnalysisPreview()).rejects.toThrow("Unauthorized")
    expect(enableAnalysisPreviewCookieMock).not.toHaveBeenCalled()
  })

  it("sets the analysis preview cookie for authenticated users", async () => {
    const { enableAnalysisPreview } = await import("@/app/dashboard/workspace-actions")

    await expect(enableAnalysisPreview()).resolves.toEqual({ success: true })
    expect(enableAnalysisPreviewCookieMock).toHaveBeenCalledTimes(1)
  })
})
