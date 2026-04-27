import { beforeEach, describe, expect, it, vi } from "vitest"

const nextAuthMock = vi.fn()
const credentialsProviderMock = vi.fn()
const compareMock = vi.fn()
const findUniqueMock = vi.fn()

type AuthConfig = {
  providers: Array<{
    authorize: (credentials?: Record<string, unknown>) => Promise<unknown>
  }>
  callbacks: {
    jwt: (args: { token: Record<string, unknown>; user?: Record<string, unknown> }) => Record<string, unknown>
    session: (args: {
      session: { user?: Record<string, unknown> }
      token: Record<string, unknown>
    }) => { user?: Record<string, unknown> }
  }
  pages: {
    signIn: string
  }
  session: {
    strategy: string
  }
}

let capturedConfig: AuthConfig | null = null

vi.mock("next-auth", () => ({
  default: nextAuthMock,
}))

vi.mock("next-auth/providers/credentials", () => ({
  default: credentialsProviderMock,
}))

vi.mock("bcryptjs", () => ({
  default: {
    compare: compareMock,
  },
}))

vi.mock("@/lib/db", () => ({
  default: {
    user: {
      findUnique: findUniqueMock,
    },
  },
}))

describe("auth", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    capturedConfig = null
    nextAuthMock.mockImplementation((config) => {
      capturedConfig = config as AuthConfig
      return {
        handlers: { GET: vi.fn(), POST: vi.fn() },
        signIn: vi.fn(),
        signOut: vi.fn(),
        auth: vi.fn(),
      }
    })
    credentialsProviderMock.mockImplementation((config) => config)
  })

  it("returns null when credentials are missing", async () => {
    await import("@/auth")
    const authorize = capturedConfig?.providers[0]?.authorize

    await expect(authorize?.()).resolves.toBeNull()
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it("returns null when the user is not found or the password is wrong", async () => {
    await import("@/auth")
    const authorize = capturedConfig?.providers[0]?.authorize

    findUniqueMock.mockResolvedValueOnce(null)
    await expect(
      authorize?.({
        email: "mentor1@amrita.edu",
        password: "faculty123",
      })
    ).resolves.toBeNull()

    findUniqueMock.mockResolvedValueOnce({
      id: "user-1",
      name: "Dr. Malathi P",
      email: "mentor1@amrita.edu",
      password: "hashed-password",
      role: "FACULTY",
      isAdmin: false,
      title: "Dr.",
      firstName: "Malathi",
      lastName: "P",
    })
    compareMock.mockResolvedValueOnce(false)

    await expect(
      authorize?.({
        email: "mentor1@amrita.edu",
        password: "wrong-password",
      })
    ).resolves.toBeNull()
  })

  it("returns the mapped user fields when credentials are valid", async () => {
    await import("@/auth")
    const authorize = capturedConfig?.providers[0]?.authorize

    findUniqueMock.mockResolvedValue({
      id: "user-1",
      name: "Dr. Malathi P",
      email: "mentor1@amrita.edu",
      password: "hashed-password",
      role: "FACULTY",
      isAdmin: false,
      title: "Dr.",
      firstName: "Malathi",
      lastName: "P",
    })
    compareMock.mockResolvedValue(true)

    await expect(
      authorize?.({
        email: "mentor1@amrita.edu",
        password: "faculty123",
      })
    ).resolves.toEqual({
      id: "user-1",
      name: "Dr. Malathi P",
      email: "mentor1@amrita.edu",
      role: "FACULTY",
      isAdmin: false,
      title: "Dr.",
      firstName: "Malathi",
      lastName: "P",
    })
  })

  it("copies role and identity fields through the jwt and session callbacks", async () => {
    await import("@/auth")

    const jwtResult = capturedConfig?.callbacks.jwt({
      token: {},
      user: {
        id: "user-1",
        role: "FACULTY",
        isAdmin: true,
        title: "Dr.",
        firstName: "Anita",
        lastName: "Raman",
      },
    })

    expect(jwtResult).toMatchObject({
      id: "user-1",
      role: "FACULTY",
      isAdmin: true,
      title: "Dr.",
      firstName: "Anita",
      lastName: "Raman",
    })

    const sessionResult = capturedConfig?.callbacks.session({
      session: { user: {} },
      token: jwtResult ?? {},
    })

    expect(sessionResult?.user).toMatchObject({
      id: "user-1",
      role: "FACULTY",
      isAdmin: true,
      title: "Dr.",
      firstName: "Anita",
      lastName: "Raman",
    })
  })

  it("falls back to non-admin session claims when JWT fields are missing or corrupted", async () => {
    await import("@/auth")

    const sessionResult = capturedConfig?.callbacks.session({
      session: { user: {} },
      token: {
        id: 123,
        role: null,
        isAdmin: "true",
        title: null,
      },
    })

    expect(sessionResult?.user).toMatchObject({
      id: "",
      role: "FACULTY",
      isAdmin: false,
      title: "Dr.",
      firstName: "",
      lastName: "",
    })
  })

  it("keeps the login page and jwt session strategy configured", async () => {
    await import("@/auth")

    expect(capturedConfig?.pages.signIn).toBe("/login")
    expect(capturedConfig?.session.strategy).toBe("jwt")
  })
})
