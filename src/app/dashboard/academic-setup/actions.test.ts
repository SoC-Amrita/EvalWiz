import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.fn()
const revalidatePathMock = vi.fn()
const canManageUsersMock = vi.fn()

const prismaMock = {
  subject: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  courseOffering: {
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  section: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  student: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  assessment: {
    count: vi.fn(),
  },
  $transaction: vi.fn(),
}

const buildAcademicPlacementMock = vi.fn()
const buildClassLabelMock = vi.fn()
const getDefaultSchoolCodeForProgramCodeMock = vi.fn()
const inferAcademicProgramLabelMock = vi.fn()
const inferProgramCodeFromLabelMock = vi.fn()
const inferSectionCodeFromLabelMock = vi.fn()
const parseStudentRollNumberMock = vi.fn()

vi.mock("@/auth", () => ({
  auth: authMock,
}))

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock("@/lib/user-roles", () => ({
  canManageUsers: canManageUsersMock,
}))

vi.mock("@/lib/db", () => ({
  default: prismaMock,
}))

vi.mock("@/lib/roll-number", () => ({
  buildAcademicPlacement: buildAcademicPlacementMock,
  buildClassLabel: buildClassLabelMock,
  getDefaultSchoolCodeForProgramCode: getDefaultSchoolCodeForProgramCodeMock,
  inferAcademicProgramLabel: inferAcademicProgramLabelMock,
  inferProgramCodeFromLabel: inferProgramCodeFromLabelMock,
  inferSectionCodeFromLabel: inferSectionCodeFromLabelMock,
  parseStudentRollNumber: parseStudentRollNumberMock,
}))

describe("academic-setup actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "FACULTY", isAdmin: true, name: "Admin User" },
    })
    canManageUsersMock.mockReturnValue(true)
    buildAcademicPlacementMock.mockReturnValue({
      semesterLabel: "VI",
      yearLabel: "III",
    })
    buildClassLabelMock.mockImplementation(
      ({ programLabel, programCode, sectionCode, batchYear }) =>
        `${programLabel} ${programCode} ${sectionCode} (${batchYear} Batch)`
    )
    getDefaultSchoolCodeForProgramCodeMock.mockReturnValue("SC")
    inferAcademicProgramLabelMock.mockReturnValue("BTech CSE")
    inferProgramCodeFromLabelMock.mockImplementation((label: string) =>
      label.toUpperCase().includes("CSE") ? "CSE" : null
    )
    inferSectionCodeFromLabelMock.mockImplementation((label: string) => label.trim().toUpperCase() || null)
    parseStudentRollNumberMock.mockImplementation((rollNo: string) => {
      if (rollNo === "CB.SC.U4CSE23001") {
        return {
          normalizedRollNo: rollNo,
          rollPrefix: "CB",
          schoolCode: "SC",
          schoolName: "School of Computing",
          levelCode: "U",
          programDurationYears: 4,
          programCode: "CSE",
          programName: "Computer Science & Engineering",
          admissionYear: "2023",
          expectedGraduationYear: "2027",
          sectionCode: "A",
          sectionIndex: 0,
          rosterNumber: "01",
        }
      }

      return null
    })
  })

  it("blocks subject deletion when offerings still exist", async () => {
    prismaMock.courseOffering.count.mockResolvedValue(1)

    const { deleteSubject } = await import("@/app/dashboard/academic-setup/actions")

    await expect(deleteSubject("sub-1")).rejects.toThrow(
      "Delete the linked course offerings before removing this subject"
    )
    expect(prismaMock.subject.delete).not.toHaveBeenCalled()
  })

  it("creates a reusable class and syncs matching students by roll signature", async () => {
    prismaMock.section.findMany.mockResolvedValue([])
    prismaMock.student.findMany.mockResolvedValue([
      { id: "stu-1", rollNo: "CB.SC.U4CSE23001" },
      { id: "stu-2", rollNo: "CB.SC.U4ECE23001" },
    ])
    prismaMock.section.create.mockResolvedValue({ id: "sec-a" })

    const { createClass } = await import("@/app/dashboard/academic-setup/actions")

    const result = await createClass({
      program: "BTech CSE",
      term: "Even / Winter",
      academicYear: "2025 - 2026",
      batchYear: "2023",
      sectionCode: "A",
      isActive: true,
    })

    expect(prismaMock.section.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "BTech CSE CSE A (2023 Batch)",
        program: "BTech CSE",
        term: "Even / Winter",
        academicYear: "2025 - 2026",
        semester: "VI",
        year: "III",
        rollPrefix: "CB",
        schoolCode: "SC",
        programCode: "CSE",
        admissionYear: "2023",
        sectionCode: "A",
        isElectiveClass: false,
      }),
    })
    expect(prismaMock.student.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["stu-1"] },
      },
      data: {
        sectionId: "sec-a",
      },
    })
    expect(result).toEqual({ success: true, syncedCount: 1 })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/academic-setup")
  })

  it("rejects elective offerings unless they have exactly one mentor", async () => {
    const { createCourseOffering } = await import("@/app/dashboard/academic-setup/actions")

    await expect(
      createCourseOffering({
        subjectId: "sub-1",
        term: "Even / Winter",
        academicYear: "2025 - 2026",
        semester: "VI",
        year: "III",
        evaluationPattern: "70 - 30",
        courseType: "Theory",
        isElective: true,
        isActive: true,
        classAssignments: [],
        mentorIds: ["mentor-1", "mentor-2"],
      })
    ).rejects.toThrow(
      "Elective offerings must have exactly one mentor, and that mentor becomes the default faculty"
    )
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
