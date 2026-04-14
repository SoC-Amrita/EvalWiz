import { afterEach, describe, expect, it, vi } from "vitest"

const originalNodeEnv = process.env.NODE_ENV
const writableEnv = process.env as { NODE_ENV?: string }

afterEach(() => {
  writableEnv.NODE_ENV = originalNodeEnv
  delete (globalThis as { prisma?: unknown }).prisma
  vi.resetModules()
  vi.restoreAllMocks()
})

describe("db", () => {
  it("creates and caches the prisma client on globalThis in development", async () => {
    writableEnv.NODE_ENV = "development"
    const prismaInstance = { tag: "prisma-dev" }
    const PrismaClient = vi.fn(class MockPrismaClient {
      constructor() {
        return prismaInstance
      }
    })

    vi.doMock("@prisma/client", () => ({
      PrismaClient,
    }))

    const db = (await import("@/lib/db")).default

    expect(db).toBe(prismaInstance)
    expect(PrismaClient).toHaveBeenCalledTimes(1)
    expect((globalThis as { prisma?: unknown }).prisma).toBe(prismaInstance)
  })

  it("reuses an existing global prisma client without constructing a new one", async () => {
    writableEnv.NODE_ENV = "development"
    const existing = { tag: "existing-prisma" }
    ;(globalThis as { prisma?: unknown }).prisma = existing
    const PrismaClient = vi.fn(class MockPrismaClient {
      constructor() {
        return { tag: "new-prisma" }
      }
    })

    vi.doMock("@prisma/client", () => ({
      PrismaClient,
    }))

    const db = (await import("@/lib/db")).default

    expect(db).toBe(existing)
    expect(PrismaClient).not.toHaveBeenCalled()
  })

  it("does not cache prisma on globalThis in production", async () => {
    writableEnv.NODE_ENV = "production"
    const prismaInstance = { tag: "prisma-prod" }
    const PrismaClient = vi.fn(class MockPrismaClient {
      constructor() {
        return prismaInstance
      }
    })

    vi.doMock("@prisma/client", () => ({
      PrismaClient,
    }))

    const db = (await import("@/lib/db")).default

    expect(db).toBe(prismaInstance)
    expect(PrismaClient).toHaveBeenCalledTimes(1)
    expect((globalThis as { prisma?: unknown }).prisma).toBeUndefined()
  })
})
