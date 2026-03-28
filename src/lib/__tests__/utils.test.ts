import { describe, it, expect } from "vitest"
import { cn } from "@/lib/utils"

describe("cn", () => {
  it("returns a single class unchanged", () => {
    expect(cn("foo")).toBe("foo")
  })

  it("merges multiple classes", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("deduplicates conflicting tailwind classes (last one wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4")
  })

  it("handles conditional classes with falsy values", () => {
    expect(cn("foo", false && "bar", null, undefined, "baz")).toBe("foo baz")
  })

  it("handles object syntax", () => {
    expect(cn({ "text-red-500": true, "text-blue-500": false })).toBe("text-red-500")
  })

  it("handles array syntax", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar")
  })

  it("returns empty string for no truthy inputs", () => {
    expect(cn(false, null, undefined)).toBe("")
  })

  it("merges tailwind text color classes correctly", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })
})
