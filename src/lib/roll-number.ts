const SCHOOL_CODE_MAP = {
  EN: "School of Engineering",
  SC: "School of Computing",
} as const

const PROGRAM_CODE_MAP = {
  CSE: "Computer Science & Engineering",
  CCE: "Computer and Communication Engineering",
  ELC: "Electrical and Computer Engineering",
  EEE: "Electrical and Electronics Engineering",
  ECE: "Electronics & Communication Engineering",
} as const

const SECTION_CODES = ["A", "B", "C", "D", "E", "F", "G", "H"] as const
const YEAR_LABELS = ["I", "II", "III", "IV", "V", "VI"] as const

function toRomanNumeral(value: number) {
  const numerals: Array<[number, string]> = [
    [10, "X"],
    [9, "IX"],
    [8, "VIII"],
    [7, "VII"],
    [6, "VI"],
    [5, "V"],
    [4, "IV"],
    [3, "III"],
    [2, "II"],
    [1, "I"],
  ]

  let remaining = value
  let result = ""
  for (const [arabic, roman] of numerals) {
    while (remaining >= arabic) {
      result += roman
      remaining -= arabic
    }
  }
  return result || `${value}`
}

export type SupportedSchoolCode = keyof typeof SCHOOL_CODE_MAP
export type SupportedProgramCode = keyof typeof PROGRAM_CODE_MAP

const PROGRAM_SCHOOL_CODE_MAP: Record<SupportedProgramCode, SupportedSchoolCode> = {
  CSE: "SC",
  CCE: "EN",
  ELC: "EN",
  EEE: "EN",
  ECE: "EN",
}

export type ParsedRollNumber = {
  normalizedRollNo: string
  rollPrefix: string
  schoolCode: string
  schoolName: string | null
  levelCode: string
  programDurationYears: number
  programCode: string
  programName: string | null
  admissionYear: string
  expectedGraduationYear: string
  sectionCode: string
  sectionIndex: number
  rosterNumber: string
}

function padAcademicYear(year: number) {
  return year.toString().padStart(4, "0")
}

export function getSchoolNameFromCode(code: string) {
  const normalized = code.trim().toUpperCase() as SupportedSchoolCode
  return SCHOOL_CODE_MAP[normalized] ?? null
}

export function getProgramNameFromCode(code: string) {
  const normalized = code.trim().toUpperCase() as SupportedProgramCode
  return PROGRAM_CODE_MAP[normalized] ?? null
}

export function inferProgramCodeFromLabel(label: string | null | undefined) {
  const normalized = label?.trim().toUpperCase() ?? ""
  if (!normalized) return null

  const tokens = normalized.split(/[^A-Z]+/).filter(Boolean)
  for (const code of Object.keys(PROGRAM_CODE_MAP) as SupportedProgramCode[]) {
    if (tokens.includes(code)) {
      return code
    }
  }

  return null
}

export function getDefaultSchoolCodeForProgramCode(code: string | null | undefined) {
  const normalized = code?.trim().toUpperCase() as SupportedProgramCode | undefined
  if (!normalized) return null
  return PROGRAM_SCHOOL_CODE_MAP[normalized] ?? null
}

export function getSectionCodeFromIndex(index: number) {
  return SECTION_CODES[index] ?? null
}

export function getSectionIndexFromCode(code: string) {
  const normalized = normalizeSectionCode(code)
  const index = SECTION_CODES.findIndex((sectionCode) => sectionCode === normalized)
  return index >= 0 ? index : null
}

export function normalizeSectionCode(value: string) {
  return value.trim().toUpperCase()
}

export function inferSectionCodeFromLabel(label: string | null | undefined) {
  const normalized = label?.trim().toUpperCase() ?? ""
  if (!normalized) return null

  if (SECTION_CODES.includes(normalized as (typeof SECTION_CODES)[number])) {
    return normalized
  }

  const match = normalized.match(/\bSECTION\s+([A-H])\b|\b([A-H])\b$/)
  const inferred = match?.[1] ?? match?.[2]
  return inferred && SECTION_CODES.includes(inferred as (typeof SECTION_CODES)[number]) ? inferred : null
}

export function getBatchYearSuffix(batchYear: string) {
  const trimmed = batchYear.trim()
  return trimmed.length >= 2 ? trimmed.slice(-2) : trimmed
}

export function formatRollSignature(input: {
  rollPrefix?: string | null
  schoolCode?: string | null
  levelCode?: string | null
  programDurationYears?: number | null
  programCode?: string | null
  admissionYear?: string | null
  sectionCode?: string | null
}) {
  const sectionIndex = getSectionIndexFromCode(input.sectionCode ?? "")
  return [
    input.rollPrefix ?? "CB",
    input.schoolCode ?? "SC",
    `${input.levelCode ?? "U"}${input.programDurationYears ?? 4}${input.programCode ?? "CSE"}${getBatchYearSuffix(input.admissionYear ?? "--")}${sectionIndex ?? "?"}xy`,
  ].join(".")
}

export function inferAcademicProgramLabel(levelCode: string, durationYears: number) {
  const normalizedLevelCode = levelCode.trim().toUpperCase()
  if (normalizedLevelCode === "U" && durationYears === 4) {
    return "B Tech"
  }
  if (normalizedLevelCode === "U") {
    return "Undergraduate"
  }
  return "Academic Program"
}

export function buildClassLabel(input: {
  programLabel: string
  programCode: string
  sectionCode: string
  batchYear: string
}) {
  const normalizedProgramLabel = input.programLabel.trim().replace(/\s+/g, " ")
  const normalizedProgramCode = input.programCode.trim().toUpperCase()
  const normalizedSectionCode = normalizeSectionCode(input.sectionCode)
  const normalizedBatchYear = input.batchYear.trim()
  const labelTokens = normalizedProgramLabel
    .split(/\s+/)
    .map((token) => token.toUpperCase())

  return [
    normalizedProgramLabel,
    labelTokens.includes(normalizedProgramCode) ? null : normalizedProgramCode,
    normalizedSectionCode,
    `(${normalizedBatchYear} Batch)`,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
}

export function parseAcademicYearStart(academicYear: string) {
  const match = academicYear.trim().match(/^(\d{4})/)
  if (!match) return null
  const startYear = Number.parseInt(match[1], 10)
  return Number.isFinite(startYear) ? startYear : null
}

export function buildAcademicPlacement(input: {
  batchYear: string
  academicYear: string
  term: string
}) {
  const batch = Number.parseInt(input.batchYear, 10)
  const academicStart = parseAcademicYearStart(input.academicYear)
  if (!Number.isFinite(batch) || academicStart === null) {
    return {
      yearLabel: "",
      semesterLabel: "",
      yearIndex: null,
      semesterIndex: null,
    }
  }

  const yearIndex = academicStart - batch + 1
  if (yearIndex <= 0) {
    return {
      yearLabel: "",
      semesterLabel: "",
      yearIndex,
      semesterIndex: null,
    }
  }

  const normalizedTerm = input.term.trim().toLowerCase()
  const isOddTerm = normalizedTerm.includes("odd") || normalizedTerm.includes("monsoon")
  const semesterIndex = isOddTerm ? yearIndex * 2 - 1 : yearIndex * 2

  return {
    yearLabel: YEAR_LABELS[yearIndex - 1] ?? toRomanNumeral(yearIndex),
    semesterLabel: toRomanNumeral(semesterIndex),
    yearIndex,
    semesterIndex,
  }
}

export function parseStudentRollNumber(rollNo: string): ParsedRollNumber | null {
  const normalizedRollNo = rollNo.trim().toUpperCase()
  const match = /^([A-Z]{2})\.([A-Z]{2})\.([A-Z])(\d)([A-Z]{3})(\d{2})(\d)(\d{2})$/.exec(normalizedRollNo)
  if (!match) {
    return null
  }

  const [, rollPrefix, schoolCode, levelCode, durationYearsText, programCode, admissionYearSuffix, sectionIndexText, rosterNumber] = match
  const admissionYear = 2000 + Number.parseInt(admissionYearSuffix, 10)
  const programDurationYears = Number.parseInt(durationYearsText, 10)
  const sectionIndex = Number.parseInt(sectionIndexText, 10)
  const sectionCode = getSectionCodeFromIndex(sectionIndex)

  if (!Number.isFinite(admissionYear) || !Number.isFinite(programDurationYears) || !sectionCode) {
    return null
  }

  return {
    normalizedRollNo,
    rollPrefix,
    schoolCode,
    schoolName: getSchoolNameFromCode(schoolCode),
    levelCode,
    programDurationYears,
    programCode,
    programName: getProgramNameFromCode(programCode),
    admissionYear: padAcademicYear(admissionYear),
    expectedGraduationYear: padAcademicYear(admissionYear + programDurationYears),
    sectionCode,
    sectionIndex,
    rosterNumber,
  }
}
