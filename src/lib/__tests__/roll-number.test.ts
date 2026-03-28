import { describe, it, expect } from "vitest"
import {
  getSchoolNameFromCode,
  getProgramNameFromCode,
  inferProgramCodeFromLabel,
  getDefaultSchoolCodeForProgramCode,
  getSectionCodeFromIndex,
  getSectionIndexFromCode,
  normalizeSectionCode,
  inferSectionCodeFromLabel,
  getBatchYearSuffix,
  formatRollSignature,
  inferAcademicProgramLabel,
  buildClassLabel,
  parseAcademicYearStart,
  buildAcademicPlacement,
  parseStudentRollNumber,
} from "@/lib/roll-number"

// ---------------------------------------------------------------------------
// getSchoolNameFromCode
// ---------------------------------------------------------------------------
describe("getSchoolNameFromCode", () => {
  it("returns the school name for 'SC'", () => {
    expect(getSchoolNameFromCode("SC")).toBe("School of Computing")
  })

  it("returns the school name for 'EN'", () => {
    expect(getSchoolNameFromCode("EN")).toBe("School of Engineering")
  })

  it("is case-insensitive", () => {
    expect(getSchoolNameFromCode("sc")).toBe("School of Computing")
  })

  it("returns null for an unknown code", () => {
    expect(getSchoolNameFromCode("XX")).toBeNull()
  })

  it("trims whitespace before lookup", () => {
    expect(getSchoolNameFromCode("  SC  ")).toBe("School of Computing")
  })
})

// ---------------------------------------------------------------------------
// getProgramNameFromCode
// ---------------------------------------------------------------------------
describe("getProgramNameFromCode", () => {
  it("returns the program name for CSE", () => {
    expect(getProgramNameFromCode("CSE")).toBe("Computer Science & Engineering")
  })

  it("returns the program name for ECE", () => {
    expect(getProgramNameFromCode("ECE")).toBe("Electronics & Communication Engineering")
  })

  it("is case-insensitive", () => {
    expect(getProgramNameFromCode("cse")).toBe("Computer Science & Engineering")
  })

  it("returns null for an unknown code", () => {
    expect(getProgramNameFromCode("XYZ")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// inferProgramCodeFromLabel
// ---------------------------------------------------------------------------
describe("inferProgramCodeFromLabel", () => {
  it("infers CSE from a label containing 'CSE'", () => {
    expect(inferProgramCodeFromLabel("B.Tech CSE")).toBe("CSE")
  })

  it("infers ECE from a label containing 'ECE'", () => {
    expect(inferProgramCodeFromLabel("ECE Department")).toBe("ECE")
  })

  it("returns null for an unrecognised label", () => {
    expect(inferProgramCodeFromLabel("Unknown Program")).toBeNull()
  })

  it("returns null for null input", () => {
    expect(inferProgramCodeFromLabel(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(inferProgramCodeFromLabel(undefined)).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(inferProgramCodeFromLabel("")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getDefaultSchoolCodeForProgramCode
// ---------------------------------------------------------------------------
describe("getDefaultSchoolCodeForProgramCode", () => {
  it("returns SC for CSE", () => {
    expect(getDefaultSchoolCodeForProgramCode("CSE")).toBe("SC")
  })

  it("returns EN for CCE", () => {
    expect(getDefaultSchoolCodeForProgramCode("CCE")).toBe("EN")
  })

  it("returns null for unknown code", () => {
    expect(getDefaultSchoolCodeForProgramCode("XYZ")).toBeNull()
  })

  it("returns null for null input", () => {
    expect(getDefaultSchoolCodeForProgramCode(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(getDefaultSchoolCodeForProgramCode(undefined)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getSectionCodeFromIndex
// ---------------------------------------------------------------------------
describe("getSectionCodeFromIndex", () => {
  it("returns A for index 0", () => {
    expect(getSectionCodeFromIndex(0)).toBe("A")
  })

  it("returns B for index 1", () => {
    expect(getSectionCodeFromIndex(1)).toBe("B")
  })

  it("returns H for index 7", () => {
    expect(getSectionCodeFromIndex(7)).toBe("H")
  })

  it("returns null for out-of-range index", () => {
    expect(getSectionCodeFromIndex(8)).toBeNull()
    expect(getSectionCodeFromIndex(-1)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getSectionIndexFromCode
// ---------------------------------------------------------------------------
describe("getSectionIndexFromCode", () => {
  it("returns 0 for A", () => {
    expect(getSectionIndexFromCode("A")).toBe(0)
  })

  it("returns 7 for H", () => {
    expect(getSectionIndexFromCode("H")).toBe(7)
  })

  it("is case-insensitive", () => {
    expect(getSectionIndexFromCode("a")).toBe(0)
  })

  it("returns null for an invalid code", () => {
    expect(getSectionIndexFromCode("Z")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// normalizeSectionCode
// ---------------------------------------------------------------------------
describe("normalizeSectionCode", () => {
  it("uppercases the value", () => {
    expect(normalizeSectionCode("a")).toBe("A")
  })

  it("trims whitespace", () => {
    expect(normalizeSectionCode("  B  ")).toBe("B")
  })
})

// ---------------------------------------------------------------------------
// inferSectionCodeFromLabel
// ---------------------------------------------------------------------------
describe("inferSectionCodeFromLabel", () => {
  it("returns the code directly when it is a single valid letter", () => {
    expect(inferSectionCodeFromLabel("A")).toBe("A")
  })

  it("infers code from 'SECTION A' pattern", () => {
    expect(inferSectionCodeFromLabel("SECTION A")).toBe("A")
  })

  it("infers code from 'Section B' (case-insensitive)", () => {
    expect(inferSectionCodeFromLabel("Section B")).toBe("B")
  })

  it("returns null for unrecognised label", () => {
    expect(inferSectionCodeFromLabel("Unknown")).toBeNull()
  })

  it("returns null for null input", () => {
    expect(inferSectionCodeFromLabel(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(inferSectionCodeFromLabel(undefined)).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(inferSectionCodeFromLabel("")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getBatchYearSuffix
// ---------------------------------------------------------------------------
describe("getBatchYearSuffix", () => {
  it("returns the last 2 characters of a 4-digit year", () => {
    expect(getBatchYearSuffix("2023")).toBe("23")
  })

  it("returns the last 2 characters when string is longer than 2", () => {
    expect(getBatchYearSuffix("2024-25")).toBe("25")
  })

  it("returns the entire string when it is 2 chars or fewer", () => {
    expect(getBatchYearSuffix("23")).toBe("23")
    expect(getBatchYearSuffix("5")).toBe("5")
  })

  it("trims whitespace before processing", () => {
    expect(getBatchYearSuffix("  2023  ")).toBe("23")
  })
})

// ---------------------------------------------------------------------------
// inferAcademicProgramLabel
// ---------------------------------------------------------------------------
describe("inferAcademicProgramLabel", () => {
  it("returns 'B Tech' for U level with 4-year duration", () => {
    expect(inferAcademicProgramLabel("U", 4)).toBe("B Tech")
  })

  it("returns 'Undergraduate' for U level with other durations", () => {
    expect(inferAcademicProgramLabel("U", 3)).toBe("Undergraduate")
  })

  it("returns 'Academic Program' for other level codes", () => {
    expect(inferAcademicProgramLabel("P", 2)).toBe("Academic Program")
  })

  it("is case-insensitive for level code", () => {
    expect(inferAcademicProgramLabel("u", 4)).toBe("B Tech")
  })
})

// ---------------------------------------------------------------------------
// buildClassLabel
// ---------------------------------------------------------------------------
describe("buildClassLabel", () => {
  it("builds a label with all parts", () => {
    const result = buildClassLabel({
      programLabel: "B Tech",
      programCode: "CSE",
      sectionCode: "A",
      batchYear: "2022",
    })
    expect(result).toContain("B Tech")
    expect(result).toContain("CSE")
    expect(result).toContain("A")
    expect(result).toContain("2022 Batch")
  })

  it("omits programCode from label when already contained in programLabel", () => {
    const result = buildClassLabel({
      programLabel: "B Tech CSE",
      programCode: "CSE",
      sectionCode: "A",
      batchYear: "2022",
    })
    // CSE should not appear twice
    const parts = result.split(" ")
    expect(parts.filter((p) => p === "CSE").length).toBe(1)
  })

  it("normalises section code to uppercase", () => {
    const result = buildClassLabel({
      programLabel: "B Tech",
      programCode: "CSE",
      sectionCode: "b",
      batchYear: "2023",
    })
    expect(result).toContain("B")
  })
})

// ---------------------------------------------------------------------------
// parseAcademicYearStart
// ---------------------------------------------------------------------------
describe("parseAcademicYearStart", () => {
  it("parses the start year from '2024 - 2025'", () => {
    expect(parseAcademicYearStart("2024 - 2025")).toBe(2024)
  })

  it("parses a standalone year string", () => {
    expect(parseAcademicYearStart("2023")).toBe(2023)
  })

  it("returns null for non-numeric input", () => {
    expect(parseAcademicYearStart("abc")).toBeNull()
  })

  it("trims whitespace", () => {
    expect(parseAcademicYearStart("  2025  ")).toBe(2025)
  })
})

// ---------------------------------------------------------------------------
// buildAcademicPlacement
// ---------------------------------------------------------------------------
describe("buildAcademicPlacement", () => {
  it("computes placement for a first-year odd semester", () => {
    const result = buildAcademicPlacement({
      batchYear: "2024",
      academicYear: "2024 - 2025",
      term: "Odd",
    })
    expect(result.yearIndex).toBe(1)
    expect(result.yearLabel).toBe("I")
    expect(result.semesterIndex).toBe(1)
    expect(result.semesterLabel).toBe("I")
  })

  it("computes placement for a first-year even/monsoon semester", () => {
    const result = buildAcademicPlacement({
      batchYear: "2024",
      academicYear: "2024 - 2025",
      term: "Even",
    })
    expect(result.yearIndex).toBe(1)
    expect(result.semesterIndex).toBe(2)
    expect(result.semesterLabel).toBe("II")
  })

  it("computes placement for a second-year odd semester", () => {
    const result = buildAcademicPlacement({
      batchYear: "2023",
      academicYear: "2024 - 2025",
      term: "Odd",
    })
    expect(result.yearIndex).toBe(2)
    expect(result.yearLabel).toBe("II")
    expect(result.semesterIndex).toBe(3)
    expect(result.semesterLabel).toBe("III")
  })

  it("returns empty labels when yearIndex <= 0", () => {
    const result = buildAcademicPlacement({
      batchYear: "2025",
      academicYear: "2024 - 2025",
      term: "Odd",
    })
    expect(result.yearLabel).toBe("")
    expect(result.semesterLabel).toBe("")
  })

  it("returns empty labels for invalid batchYear", () => {
    const result = buildAcademicPlacement({
      batchYear: "notAYear",
      academicYear: "2024 - 2025",
      term: "Odd",
    })
    expect(result.yearLabel).toBe("")
    expect(result.semesterLabel).toBe("")
    expect(result.yearIndex).toBeNull()
    expect(result.semesterIndex).toBeNull()
  })

  it("recognises 'monsoon' as an odd-term indicator", () => {
    const result = buildAcademicPlacement({
      batchYear: "2024",
      academicYear: "2024 - 2025",
      term: "Monsoon",
    })
    expect(result.semesterIndex).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// parseStudentRollNumber
// ---------------------------------------------------------------------------
describe("parseStudentRollNumber", () => {
  const VALID_ROLL = "CB.SC.U4CSE23001"

  it("parses a valid CSE roll number", () => {
    const result = parseStudentRollNumber(VALID_ROLL)
    expect(result).not.toBeNull()
    expect(result!.rollPrefix).toBe("CB")
    expect(result!.schoolCode).toBe("SC")
    expect(result!.levelCode).toBe("U")
    expect(result!.programDurationYears).toBe(4)
    expect(result!.programCode).toBe("CSE")
    expect(result!.admissionYear).toBe("2023")
    expect(result!.sectionIndex).toBe(0)
    expect(result!.sectionCode).toBe("A")
    expect(result!.rosterNumber).toBe("01")
    expect(result!.schoolName).toBe("School of Computing")
    expect(result!.programName).toBe("Computer Science & Engineering")
  })

  it("normalises the roll number to uppercase", () => {
    const result = parseStudentRollNumber(VALID_ROLL.toLowerCase())
    expect(result).not.toBeNull()
    expect(result!.normalizedRollNo).toBe(VALID_ROLL)
  })

  it("returns null for an invalid roll number format", () => {
    expect(parseStudentRollNumber("INVALID")).toBeNull()
  })

  it("returns null for an empty string", () => {
    expect(parseStudentRollNumber("")).toBeNull()
  })

  it("computes expectedGraduationYear correctly", () => {
    const result = parseStudentRollNumber(VALID_ROLL)
    expect(result!.expectedGraduationYear).toBe("2027")
  })

  it("parses a section B roll number (sectionIndex 1)", () => {
    // CB.SC.U4CSE23101 => sectionIndex=1 => B
    const result = parseStudentRollNumber("CB.SC.U4CSE23101")
    expect(result).not.toBeNull()
    expect(result!.sectionCode).toBe("B")
    expect(result!.sectionIndex).toBe(1)
  })

  it("returns null when section index is out of range (>= 8)", () => {
    // CB.SC.U4CSE23801 => sectionIndex=8 => out of range
    const result = parseStudentRollNumber("CB.SC.U4CSE23801")
    expect(result).toBeNull()
  })
})
