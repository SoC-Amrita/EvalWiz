import { describe, it, expect } from "vitest"
import {
  formatWorkspaceCode,
  formatWorkspaceIdentity,
  formatWorkspaceCycleLabel,
  formatWorkspaceProgramSummary,
  formatWorkspaceFullLabel,
  formatWorkspaceRoleHeading,
  formatCompactSectionName,
  formatDetailedCompactSectionName,
} from "@/lib/workspace-labels"

const baseWorkspace = {
  subjectCode: "CS101",
  subjectTitle: "Intro to CS",
  program: "B Tech CSE",
  semester: "II",
  academicYear: "2024 - 2025",
  term: "Even",
  year: "I",
  batchLabel: "2023 Batch",
}

describe("formatWorkspaceCode", () => {
  it("returns the trimmed subject code", () => {
    expect(formatWorkspaceCode({ subjectCode: "  CS101  " })).toBe("CS101")
  })

  it("returns 'Selected course' when subjectCode is empty", () => {
    expect(formatWorkspaceCode({ subjectCode: "" })).toBe("Selected course")
  })

  it("returns 'Selected course' when subjectCode is null", () => {
    expect(formatWorkspaceCode({ subjectCode: null as unknown as string })).toBe("Selected course")
  })
})

describe("formatWorkspaceIdentity", () => {
  it("joins code and title", () => {
    expect(formatWorkspaceIdentity({ subjectCode: "CS101", subjectTitle: "Intro to CS" })).toBe(
      "CS101 Intro to CS"
    )
  })

  it("omits falsy parts", () => {
    expect(formatWorkspaceIdentity({ subjectCode: "CS101", subjectTitle: "" })).toBe("CS101")
    expect(formatWorkspaceIdentity({ subjectCode: "", subjectTitle: "Intro to CS" })).toBe(
      "Intro to CS"
    )
  })
})

describe("formatWorkspaceCycleLabel", () => {
  it("joins academicYear and term", () => {
    expect(formatWorkspaceCycleLabel({ academicYear: "2024 - 2025", term: "Even" })).toBe(
      "2024 - 2025 Even"
    )
  })

  it("omits falsy parts", () => {
    expect(formatWorkspaceCycleLabel({ academicYear: "2024 - 2025", term: "" })).toBe("2024 - 2025")
    expect(formatWorkspaceCycleLabel({ academicYear: "", term: "Odd" })).toBe("Odd")
  })
})

describe("formatWorkspaceProgramSummary", () => {
  it("builds a summary with all fields present", () => {
    const result = formatWorkspaceProgramSummary(baseWorkspace)
    expect(result).toContain("B Tech CSE")
    expect(result).toContain("II Semester")
    expect(result).toContain("Year I")
    expect(result).toContain("2023 Batch")
  })

  it("omits semester when empty", () => {
    const ws = { ...baseWorkspace, semester: "" }
    expect(formatWorkspaceProgramSummary(ws)).not.toContain("Semester")
  })

  it("omits year when empty", () => {
    const ws = { ...baseWorkspace, year: "" }
    expect(formatWorkspaceProgramSummary(ws)).not.toContain("Year")
  })
})

describe("formatWorkspaceFullLabel", () => {
  it("builds a full label with all fields present", () => {
    const result = formatWorkspaceFullLabel(baseWorkspace)
    expect(result).toContain("CS101")
    expect(result).toContain("Intro to CS")
    expect(result).toContain("B Tech CSE")
    expect(result).toContain("II Semester")
    expect(result).toContain("2024 - 2025")
    expect(result).toContain("Even")
  })
})

describe("formatWorkspaceRoleHeading", () => {
  it("prefixes roleLabel with the workspace code", () => {
    expect(formatWorkspaceRoleHeading("Faculty", { subjectCode: "CS101" })).toBe(
      "Faculty view for CS101"
    )
  })

  it("uses 'Selected course' when subjectCode is empty", () => {
    expect(formatWorkspaceRoleHeading("Admin", { subjectCode: "" })).toBe(
      "Admin view for Selected course"
    )
  })
})

describe("formatCompactSectionName", () => {
  it("returns the sectionCode when provided", () => {
    expect(formatCompactSectionName("Section A", "a")).toBe("A")
  })

  it("infers section code from name when sectionCode is absent", () => {
    expect(formatCompactSectionName("SECTION A")).toBe("A")
  })

  it("falls back to original sectionName when code cannot be inferred", () => {
    expect(formatCompactSectionName("Unknown section label")).toBe("Unknown section label")
  })
})

describe("formatDetailedCompactSectionName", () => {
  it("formats with semester, programCode, and sectionCode", () => {
    const result = formatDetailedCompactSectionName({
      name: "CSE-A",
      semester: "VI",
      programCode: "CSE",
      sectionCode: "A",
    })
    expect(result).toBe("VI CSE A")
  })

  it("falls back to compact format when any key part is missing", () => {
    const result = formatDetailedCompactSectionName({
      name: "SECTION B",
      semester: null,
      programCode: "CSE",
      sectionCode: "B",
    })
    expect(result).toBe("B")
  })

  it("infers sectionCode from name when sectionCode field is missing", () => {
    const result = formatDetailedCompactSectionName({
      name: "SECTION C",
      semester: "II",
      programCode: "CSE",
      sectionCode: null,
    })
    expect(result).toBe("II CSE C")
  })
})
