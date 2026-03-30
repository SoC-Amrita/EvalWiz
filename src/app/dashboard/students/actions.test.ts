import { beforeEach, describe, expect, it, vi } from "vitest"

const revalidatePathMock = vi.fn()
const requireAdminUserMock = vi.fn()
const requireAllowedSectionAccessMock = vi.fn()
const requireAuthenticatedWorkspaceStateMock = vi.fn()
const requireRealWorkspaceMock = vi.fn()

const prismaMock = {
  section: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  student: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  courseOfferingClass: {
    findFirst: vi.fn(),
  },
  courseOfferingEnrollment: {
    upsert: vi.fn(),
  },
  assessment: {
    findFirst: vi.fn(),
  },
  mark: {
    upsert: vi.fn(),
  },
}

const buildClassLabelMock = vi.fn()
const inferAcademicProgramLabelMock = vi.fn()
const normalizeSectionCodeMock = vi.fn()
const parseStudentRollNumberMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock("@/lib/db", () => ({
  default: prismaMock,
}))

vi.mock("@/lib/workspace-guards", () => ({
  requireAdminUser: requireAdminUserMock,
  requireAllowedSectionAccess: requireAllowedSectionAccessMock,
  requireAuthenticatedWorkspaceState: requireAuthenticatedWorkspaceStateMock,
  requireRealWorkspace: requireRealWorkspaceMock,
}))

vi.mock("@/lib/roll-number", () => ({
  buildClassLabel: buildClassLabelMock,
  inferAcademicProgramLabel: inferAcademicProgramLabelMock,
  normalizeSectionCode: normalizeSectionCodeMock,
  parseStudentRollNumber: parseStudentRollNumberMock,
}))

describe("student actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", isAdmin: true })
    requireAuthenticatedWorkspaceStateMock.mockResolvedValue({
      user: { id: "admin-1", isAdmin: true },
      activeWorkspace: { offeringId: "off-1", isElective: true },
    })
    requireAllowedSectionAccessMock.mockResolvedValue({
      user: { id: "admin-1", isAdmin: true },
      activeWorkspace: { offeringId: "off-1", isElective: false },
      allowedSectionIds: new Set(["sec-a"]),
    })
    inferAcademicProgramLabelMock.mockReturnValue("BTech CSE")
    buildClassLabelMock.mockImplementation(
      ({ programLabel, programCode, sectionCode, batchYear }) =>
        `${programLabel} ${programCode} ${sectionCode} (${batchYear} Batch)`
    )
    normalizeSectionCodeMock.mockImplementation((value: string) => value.trim().toUpperCase())
    parseStudentRollNumberMock.mockImplementation((rollNo: string) => {
      if (rollNo === "CB.SC.U4CSE23001") {
        return {
          rollPrefix: "CB",
          schoolCode: "SC",
          levelCode: "U",
          programDurationYears: 4,
          programCode: "CSE",
          admissionYear: "2023",
          expectedGraduationYear: "2027",
          sectionCode: "A",
        }
      }
      return null
    })
  })

  it("uploads students and enrolls them into the active elective offering", async () => {
    prismaMock.courseOfferingClass.findFirst.mockResolvedValue({ sectionId: "elective-sec" })
    prismaMock.section.findMany.mockResolvedValue([
      {
        id: "home-sec-a",
        name: "BTech CSE A (2023 Batch)",
        rollPrefix: "CB",
        schoolCode: "SC",
        levelCode: "U",
        programDurationYears: 4,
        programCode: "CSE",
        admissionYear: "2023",
        sectionCode: "A",
      },
    ])
    prismaMock.student.upsert.mockResolvedValue({ id: "stu-1" })

    const { uploadStudents } = await import("@/app/dashboard/students/actions")

    const result = await uploadStudents([
      { rollNo: "CB.SC.U4CSE23001", name: "Asha" },
    ])

    expect(prismaMock.student.upsert).toHaveBeenCalledWith({
      where: { rollNo: "CB.SC.U4CSE23001" },
      update: { name: "Asha", sectionId: "home-sec-a" },
      create: { rollNo: "CB.SC.U4CSE23001", name: "Asha", sectionId: "home-sec-a" },
    })
    expect(prismaMock.courseOfferingEnrollment.upsert).toHaveBeenCalledWith({
      where: {
        offeringId_studentId: {
          offeringId: "off-1",
          studentId: "stu-1",
        },
      },
      update: {
        sectionId: "elective-sec",
      },
      create: {
        offeringId: "off-1",
        studentId: "stu-1",
        sectionId: "elective-sec",
      },
    })
    expect(result).toEqual({
      success: true,
      successCount: 1,
      errorCount: 0,
      errors: [],
    })
  })

  it("blocks manual student creation when the roll number already exists", async () => {
    prismaMock.section.findUnique.mockResolvedValue({ id: "sec-a" })
    prismaMock.student.findUnique.mockResolvedValue({ id: "stu-1" })

    const { createStudentRecord } = await import("@/app/dashboard/students/actions")

    await expect(
      createStudentRecord({
        rollNo: "CB.SC.U4CSE23001",
        name: "Asha",
        sectionId: "sec-a",
      })
    ).rejects.toThrow(
      "A student with this roll number already exists. Use Edit Student for manual reassignment."
    )
  })

  it("saves a student mark for an in-scope admin workspace view", async () => {
    prismaMock.assessment.findFirst.mockResolvedValue({
      id: "assess-1",
      offeringId: "off-1",
      maxMarks: 50,
    })
    prismaMock.student.findUnique.mockResolvedValue({ sectionId: "sec-a" })

    const { saveStudentMark } = await import("@/app/dashboard/students/actions")

    await expect(saveStudentMark("stu-1", "assess-1", 42)).resolves.toEqual({ success: true })
    expect(prismaMock.mark.upsert).toHaveBeenCalledWith({
      where: { studentId_assessmentId: { studentId: "stu-1", assessmentId: "assess-1" } },
      update: { marks: 42 },
      create: { studentId: "stu-1", assessmentId: "assess-1", marks: 42 },
    })
  })
})
