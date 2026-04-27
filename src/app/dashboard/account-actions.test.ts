import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.fn()
const signOutMock = vi.fn()
const compareMock = vi.fn()
const hashMock = vi.fn()

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

vi.mock("@/auth", () => ({
  auth: authMock,
  signOut: signOutMock,
}))

vi.mock("bcryptjs", () => ({
  default: {
    compare: compareMock,
    hash: hashMock,
  },
}))

vi.mock("@/lib/db", () => ({
  default: prismaMock,
}))

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
    authMock.mockResolvedValue({
      user: { id: "user-1", name: "Dr. Faculty" },
    })
    prismaMock.user.findUnique.mockResolvedValue({ password: "stored-hash" })
    compareMock.mockResolvedValue(true)
    hashMock.mockResolvedValue("next-hash")
  })

  it("signs users out to the login page", async () => {
    const { signOutToLogin } = await import("@/app/dashboard/account-actions")

    await signOutToLogin()
    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/login" })
  })

  it("requires authentication before changing the current user's password", async () => {
    authMock.mockResolvedValue(null)

    const { changeOwnPassword } = await import("@/app/dashboard/account-actions")

    await expect(
      changeOwnPassword(passwordForm({
        currentPassword: "Oldpass123#",
        newPassword: "Newpass123#",
        confirmPassword: "Newpass123#",
      }))
    ).rejects.toThrow("Unauthorized")
    expect(prismaMock.user.update).not.toHaveBeenCalled()
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
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("rejects an incorrect current password", async () => {
    compareMock.mockResolvedValue(false)

    const { changeOwnPassword } = await import("@/app/dashboard/account-actions")

    await expect(
      changeOwnPassword(passwordForm({
        currentPassword: "Wrongpass123#",
        newPassword: "Newpass123#",
        confirmPassword: "Newpass123#",
      }))
    ).rejects.toThrow("Current password is incorrect")
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("updates the current user's password with a hash", async () => {
    const { changeOwnPassword } = await import("@/app/dashboard/account-actions")

    await expect(
      changeOwnPassword(passwordForm({
        currentPassword: "Oldpass123#",
        newPassword: "Newpass123#",
        confirmPassword: "Newpass123#",
      }))
    ).resolves.toEqual({ success: true })
    expect(compareMock).toHaveBeenCalledWith("Oldpass123#", "stored-hash")
    expect(hashMock).toHaveBeenCalledWith("Newpass123#", 10)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "next-hash" },
    })
  })
})
