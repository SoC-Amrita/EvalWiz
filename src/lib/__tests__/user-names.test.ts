import { describe, it, expect } from "vitest"
import { buildDisplayName, buildNameFields } from "@/lib/user-names"

describe("buildDisplayName", () => {
  it("builds a full name from title, firstName, and lastName", () => {
    expect(buildDisplayName({ title: "Dr.", firstName: "Jane", lastName: "Smith" })).toBe(
      "Dr. Jane Smith"
    )
  })

  it("omits title when not provided", () => {
    expect(buildDisplayName({ firstName: "Jane", lastName: "Smith" })).toBe("Jane Smith")
  })

  it("omits lastName when not provided", () => {
    expect(buildDisplayName({ title: "Mr.", firstName: "John" })).toBe("Mr. John")
  })

  it("uses only firstName when title and lastName are absent", () => {
    expect(buildDisplayName({ firstName: "Alice" })).toBe("Alice")
  })

  it("falls back to name field when all name parts are absent", () => {
    expect(buildDisplayName({ name: "Fallback Name" })).toBe("Fallback Name")
  })

  it("trims the name fallback", () => {
    expect(buildDisplayName({ name: "  Trimmed  " })).toBe("Trimmed")
  })

  it("returns 'Unknown User' when all fields are absent", () => {
    expect(buildDisplayName({})).toBe("Unknown User")
  })

  it("returns 'Unknown User' when all fields are null", () => {
    expect(buildDisplayName({ title: null, firstName: null, lastName: null, name: null })).toBe(
      "Unknown User"
    )
  })

  it("collapses extra whitespace within and between parts", () => {
    expect(buildDisplayName({ title: "Prof.", firstName: "  Bob  ", lastName: "  Jones  " })).toBe(
      "Prof. Bob Jones"
    )
  })

  it("prioritises name parts over the name fallback", () => {
    expect(
      buildDisplayName({ firstName: "Alice", lastName: "Wonder", name: "Should not appear" })
    ).toBe("Alice Wonder")
  })
})

describe("buildNameFields", () => {
  it("trims and normalises all parts", () => {
    const result = buildNameFields({ title: " Dr. ", firstName: " Jane ", lastName: " Smith " })
    expect(result.title).toBe("Dr.")
    expect(result.firstName).toBe("Jane")
    expect(result.lastName).toBe("Smith")
    expect(result.name).toBe("Dr. Jane Smith")
  })

  it("returns empty strings for empty inputs", () => {
    const result = buildNameFields({ title: "", firstName: "", lastName: "" })
    expect(result.title).toBe("")
    expect(result.firstName).toBe("")
    expect(result.lastName).toBe("")
    expect(result.name).toBe("Unknown User")
  })

  it("builds name without title when title is empty", () => {
    const result = buildNameFields({ title: "", firstName: "Alice", lastName: "Smith" })
    expect(result.name).toBe("Alice Smith")
  })
})
