import { beforeEach, describe, expect, it, vi } from "vitest"

const cookiesMock = vi.fn()

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}))

describe("analysis-preview-access", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sets the unlock cookie with the expected options", async () => {
    const set = vi.fn()
    cookiesMock.mockResolvedValue({ set, get: vi.fn() })

    const { ANALYSIS_PREVIEW_COOKIE, enableAnalysisPreviewCookie } = await import("@/lib/analysis-preview-access")

    await enableAnalysisPreviewCookie()

    expect(set).toHaveBeenCalledWith(ANALYSIS_PREVIEW_COOKIE, "unlocked", {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: true,
    })
  })

  it("returns true when the unlock cookie is present", async () => {
    cookiesMock.mockResolvedValue({
      set: vi.fn(),
      get: vi.fn(() => ({ value: "unlocked" })),
    })

    const { hasAnalysisPreviewAccess } = await import("@/lib/analysis-preview-access")

    await expect(hasAnalysisPreviewAccess()).resolves.toBe(true)
  })

  it("returns false when the unlock cookie is absent", async () => {
    cookiesMock.mockResolvedValue({
      set: vi.fn(),
      get: vi.fn(() => undefined),
    })

    const { hasAnalysisPreviewAccess } = await import("@/lib/analysis-preview-access")

    await expect(hasAnalysisPreviewAccess()).resolves.toBe(false)
  })
})
