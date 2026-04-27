import { describe, it, expect } from "vitest"
import {
  isAdminRole,
  canManageUsers,
} from "@/lib/user-roles"

describe("isAdminRole", () => {
  it("returns true when isAdmin is true on context object", () => {
    expect(isAdminRole({ isAdmin: true })).toBe(true)
  })

  it("returns false when isAdmin is false on context object", () => {
    expect(isAdminRole({ isAdmin: false })).toBe(false)
  })

  it("returns false when isAdmin is null on context object", () => {
    expect(isAdminRole({ isAdmin: null })).toBe(false)
  })

  it("returns false for null context", () => {
    expect(isAdminRole(null)).toBe(false)
  })

  it("returns false for undefined context", () => {
    expect(isAdminRole(undefined)).toBe(false)
  })
})

describe("canManageUsers", () => {
  it("returns true when isAdmin is true", () => {
    expect(canManageUsers({ isAdmin: true })).toBe(true)
  })

  it("returns false when isAdmin is false", () => {
    expect(canManageUsers({ isAdmin: false })).toBe(false)
  })

  it("returns false for null", () => {
    expect(canManageUsers(null)).toBe(false)
  })

  it("returns false for undefined", () => {
    expect(canManageUsers(undefined)).toBe(false)
  })
})
