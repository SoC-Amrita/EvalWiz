import { describe, it, expect } from "vitest"
import {
  isAdminRole,
  isFacultyRole,
  canManageUsers,
} from "@/lib/user-roles"

describe("isAdminRole", () => {
  it("returns true when isAdmin is true on context object", () => {
    expect(isAdminRole({ role: "FACULTY", isAdmin: true })).toBe(true)
  })

  it("returns false when isAdmin is false on context object", () => {
    expect(isAdminRole({ role: "FACULTY", isAdmin: false })).toBe(false)
  })

  it("returns false when isAdmin is null on context object", () => {
    expect(isAdminRole({ role: "FACULTY", isAdmin: null })).toBe(false)
  })

  it("returns false for a plain string (no admin property)", () => {
    expect(isAdminRole("FACULTY")).toBe(false)
  })

  it("returns false for null context", () => {
    expect(isAdminRole(null)).toBe(false)
  })

  it("returns false for undefined context", () => {
    expect(isAdminRole(undefined)).toBe(false)
  })
})

describe("isFacultyRole", () => {
  it("returns true when role is set on context object", () => {
    expect(isFacultyRole({ role: "FACULTY" })).toBe(true)
  })

  it("returns false when role is null on context object", () => {
    expect(isFacultyRole({ role: null })).toBe(false)
  })

  it("returns false when role is undefined on context object", () => {
    expect(isFacultyRole({ role: undefined })).toBe(false)
  })

  it("returns true for a plain string (string is treated as role)", () => {
    expect(isFacultyRole("FACULTY")).toBe(true)
  })

  it("returns false for null context", () => {
    expect(isFacultyRole(null)).toBe(false)
  })

  it("returns false for undefined context", () => {
    expect(isFacultyRole(undefined)).toBe(false)
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
