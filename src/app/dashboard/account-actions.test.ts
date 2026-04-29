import { beforeEach, describe, expect, it, vi } from "vitest"

const getSessionUserMock = vi.fn()
const redirectMock = vi.fn()
const supabaseSignOutMock = vi.fn()
const supabaseSignInMock = vi.fn()
const supabaseAdminUpdateUserMock = vi.fn()

vi.mock("@/lib/session", () => ({
  getSessionUser: getSessionUserMock,
}))

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}))

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      signOut: supabaseSignOutMock,
      signInWithPassword: supabaseSignInMock,
    },
  }),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn().mockReturnValue({
    auth: {
      admin: {
        updateUserById: supabaseAdminUpdateUserMock,
      },
    },
  }),
}))

// Prisma is no longer used in account-actions but mock to prevent import errors.
vi.mock("@/lib/db", () => ({ default: {} }))

function passwordForm(values: {
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
}) {
  const formData = new FormData()
  if (values.currentPassword !== undefined) formData.set("currentPassword", values.currentPassword)
  if (values.newPassword !== undefined) formData.set("newPassword", values.newPassword)
  if (values.confirmPassword !== undefined) formData.set("confirmPassword", values.confirmPassword)
  return formData
}

describe("account actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionUserMock.mockResolvedValue({
      id: "user-1",
      supabaseId: "supa-uuid-1",
      email: "faculty@amrita.edu",
      name: "Dr. Faculty",
    })
    supabaseSignInMock.mockResolvedValue({ error: null })
    supabaseAdminUpdateUserMock.mockResolvedValue({ error: null })
  })

  it("signs users out to the login page", async () => {
    supabaseSignOutMock.mockResolvedValue({ error: null })

    const { signOutToLogin } = await import("@/app/dashboard/account-actions")

    await signOutToLogin()
    expect(supabaseSignOutMock).toHaveBeenCalledTimes(1)
    expect(redirectMock).toHaveBeenCalledWith("/login")
  })

  it("requires authentication before changing the current user's password", async () => {
    getSessionUserMock.mockResolvedValue(null)

    const { changeOwnPassword } = await import("@/app/dashboard/account-actions")

    await expect(
      changeOwnPassword(passwordForm({
        currentPassword: "Oldpass123#",
        newPassword: "Newpass123#",
        confirmPassword: "Newpass123#",
      }))
    ).rejects.toThrow("Unauthorized")
    expect(supabaseAdminUpdateUserMock).not.toHaveBeenCalled()
  })

  it("enforces password completeness, length, confirmation, and difference", async () => {
    const { changeOwnPassword } = await import("@/app/dashboard/account-actions")

    await expect(changeOwnPassword(passwordForm({ currentPassword: "Oldpass123#" }))).rejects.toThrow(
      "Please fill in all password fields"
    )
    await expect(
      changeOwnPassword(passwordForm({
        currentPassword: "Oldpass123#",
        newPassword: "short",
        confirmPassword: "short",
      }))
    ).rejects.toThrow("New password must be at least 8 characters long")
    await expect(
      changeOwnPassword(passwordForm({
        currentPassword: "Oldpass123#",
        newPassword: "Newpass123#",
        confirmPassword: "Different123#",
      }))
    ).rejects.toThrow("New password and confirmation do not match")
    await expect(
      changeOwnPassword(passwordForm({
        currentPassword: "Samepass123#",
        newPassword: "Samepass123#",
        confirmPassword: "Samepass123#",
      }))
    ).rejects.toThrow("New password must be different from the current password")
    expect(supabaseAdminUpdateUserMock).not.toHaveBeenCalled()
  })

  it("rejects an incorrect current password", async () => {
    supabaseSignInMock.mockResolvedValue({ error: { message: "Invalid login credentials" } })

    const { changeOwnPassword } = await import("@/app/dashboard/account-actions")

    await expect(
      changeOwnPassword(passwordForm({
        currentPassword: "Wrongpass123#",
        newPassword: "Newpass123#",
        confirmPassword: "Newpass123#",
      }))
    ).rejects.toThrow("Current password is incorrect")
    expect(supabaseAdminUpdateUserMock).not.toHaveBeenCalled()
  })

  it("verifies the current password and updates via Supabase admin", async () => {
    const { changeOwnPassword } = await import("@/app/dashboard/account-actions")

    await expect(
      changeOwnPassword(passwordForm({
        currentPassword: "Oldpass123#",
        newPassword: "Newpass123#",
        confirmPassword: "Newpass123#",
      }))
    ).resolves.toEqual({ success: true })
    expect(supabaseSignInMock).toHaveBeenCalledWith({
      email: "faculty@amrita.edu",
      password: "Oldpass123#",
    })
    expect(supabaseAdminUpdateUserMock).toHaveBeenCalledWith("supa-uuid-1", {
      password: "Newpass123#",
    })
  })
})
