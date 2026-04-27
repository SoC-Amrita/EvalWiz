import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.fn()
const revalidatePathMock = vi.fn()
const hashMock = vi.fn()
const buildNameFieldsMock = vi.fn()
const canManageUsersMock = vi.fn()

const transactionClient = {
  user: {
    create: vi.fn(),
    update: vi.fn(),
  },
  faculty: {
    create: vi.fn(),
    update: vi.fn(),
  },
}

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/auth", () => ({
  auth: authMock,
}))

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock("bcryptjs", () => ({
  default: {
    hash: hashMock,
  },
}))

vi.mock("@/lib/db", () => ({
  default: prismaMock,
}))

vi.mock("@/lib/user-names", () => ({
  buildNameFields: buildNameFieldsMock,
}))

vi.mock("@/lib/user-roles", () => ({
  canManageUsers: canManageUsersMock,
}))

describe("users actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({
      user: { id: "admin-1", name: "Admin User", isAdmin: true },
    })
    canManageUsersMock.mockReturnValue(true)
    hashMock.mockResolvedValue("hashed-password")
    buildNameFieldsMock.mockReturnValue({
      title: "Dr.",
      firstName: "New",
      lastName: "Faculty",
      name: "Dr. New Faculty",
    })
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transactionClient))
    transactionClient.user.create.mockResolvedValue({ id: "user-2" })
  })

  it("requires an admin user for account creation", async () => {
    canManageUsersMock.mockReturnValue(false)

    const { createUserAccount } = await import("@/app/dashboard/users/actions")

    await expect(
      createUserAccount({
        title: "Dr.",
        firstName: "New",
        lastName: "Faculty",
        email: "new@example.com",
        password: "Randompass123#",
        isAdmin: false,
      })
    ).rejects.toThrow("Unauthorized")
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it("enforces a minimum password length when creating users", async () => {
    const { createUserAccount } = await import("@/app/dashboard/users/actions")

    await expect(
      createUserAccount({
        title: "Dr.",
        firstName: "New",
        lastName: "Faculty",
        email: "new@example.com",
        password: "short",
        isAdmin: false,
      })
    ).rejects.toThrow("Password must be at least 8 characters long")
    expect(hashMock).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("creates a faculty-backed account with a hashed password", async () => {
    const { createUserAccount } = await import("@/app/dashboard/users/actions")

    await expect(
      createUserAccount({
        title: "Dr.",
        firstName: "New",
        lastName: "Faculty",
        email: " new@example.com ",
        password: "Randompass123#",
        isAdmin: false,
      })
    ).resolves.toEqual({ success: true })
    expect(hashMock).toHaveBeenCalledWith("Randompass123#", 10)
    expect(transactionClient.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "new@example.com",
        password: "hashed-password",
        role: "FACULTY",
        isAdmin: false,
      }),
    })
    expect(transactionClient.faculty.create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        name: "Dr. New Faculty",
      },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/users")
  })

  it("enforces a minimum password length when resetting users", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isAdmin: false })

    const { resetUserPassword } = await import("@/app/dashboard/users/actions")

    await expect(resetUserPassword("user-2", "short")).rejects.toThrow(
      "New password must be at least 8 characters long"
    )
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("resets a user password with a hash", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isAdmin: false })

    const { resetUserPassword } = await import("@/app/dashboard/users/actions")

    await expect(resetUserPassword("user-2", "Randompass123#")).resolves.toEqual({ success: true })
    expect(hashMock).toHaveBeenCalledWith("Randompass123#", 10)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { password: "hashed-password" },
    })
  })

  it("prevents deleting the last administrator account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "admin-2",
      isAdmin: true,
    })
    prismaMock.user.count.mockResolvedValue(1)

    const { deleteUserAccount } = await import("@/app/dashboard/users/actions")

    await expect(deleteUserAccount("admin-2")).rejects.toThrow(
      "At least one administrator account must remain"
    )
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })

  it("prevents deleting the currently signed-in account", async () => {
    const { deleteUserAccount } = await import("@/app/dashboard/users/actions")

    await expect(deleteUserAccount("admin-1")).rejects.toThrow(
      "You cannot delete the account you are currently signed in with"
    )
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })
})
