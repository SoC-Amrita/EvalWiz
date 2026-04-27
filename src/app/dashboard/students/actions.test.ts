import { beforeEach, describe, expect, it, vi } from "vitest"

const revalidatePathMock = vi.fn()
const requireAdminUserMock = vi.fn()
const requireAllowedSectionAccessMock = vi.fn()
const requireAuthenticatedWorkspaceStateMock = vi.fn()
const requireRealWorkspaceMock = vi.fn()
const getAllowedStudentIdsForWorkspaceMock = vi.fn()

const prismaMock = {
  $transaction: vi.fn(),
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
  archivedStudent: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  courseOfferingClass: {
    findFirst: vi.fn(),
  },
  courseOfferingEnrollment: {
    upsert: vi.fn(),
    create: vi.fn(),
  },
  studentDeletionRequest: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  courseOffering: {
    findUnique: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
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

vi.mock("@/lib/course-workspace", () => ({
  getAllowedStudentIdsForWorkspace: getAllowedStudentIdsForWorkspaceMock,
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
    getAllowedStudentIdsForWorkspaceMock.mockResolvedValue(["stu-1"])
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
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock as never))
    prismaMock.archivedStudent.create.mockResolvedValue({ id: "arch-1" })
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

  it("updates analytics exclusion along with student details", async () => {
    const { updateStudentRecord } = await import("@/app/dashboard/students/actions")

    await expect(
      updateStudentRecord({
        studentId: "stu-1",
        rollNo: "CB.SC.U4CSE23001",
        name: "Asha",
        sectionId: "sec-a",
        excludeFromAnalytics: true,
      })
    ).resolves.toEqual({ success: true })

    expect(prismaMock.student.update).toHaveBeenCalledWith({
      where: { id: "stu-1" },
      data: {
        rollNo: "CB.SC.U4CSE23001",
        name: "Asha",
        sectionId: "sec-a",
        excludeFromAnalytics: true,
      },
    })
  })

  it("archives the student snapshot before deleting the active record", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      rollNo: "CB.SC.U4CSE23001",
      name: "Asha",
      sectionId: "sec-a",
      excludeFromAnalytics: true,
      section: { name: "Section A" },
      offeringEnrollments: [
        {
          offeringId: "off-1",
          sectionId: "sec-a",
          section: { name: "Section A" },
          offering: {
            term: "Even / Winter",
            academicYear: "2025 - 2026",
            semester: "VI",
            year: "III",
            courseType: "Theory",
            evaluationPattern: "70 - 30",
            subject: {
              code: "23CSE311",
              title: "Software Engineering",
            },
          },
        },
      ],
      marks: [
        {
          assessmentId: "assess-1",
          marks: 42,
          assessment: {
            name: "Midterm",
            code: "MID",
            category: "MID_TERM",
            maxMarks: 50,
            weightage: 20,
            offering: {
              id: "off-1",
              term: "Even / Winter",
              academicYear: "2025 - 2026",
              semester: "VI",
              year: "III",
              courseType: "Theory",
              evaluationPattern: "70 - 30",
              subject: {
                code: "23CSE311",
                title: "Software Engineering",
              },
            },
          },
        },
      ],
    })

    const { deleteStudentRecord } = await import("@/app/dashboard/students/actions")

    await expect(deleteStudentRecord("stu-1")).resolves.toEqual({ success: true })
    expect(prismaMock.archivedStudent.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "STUDENT_ARCHIVE_DELETE",
        userId: "admin-1",
        details: JSON.stringify({
          studentId: "stu-1",
          rollNo: "CB.SC.U4CSE23001",
          name: "Asha",
          markCount: 1,
          enrollmentCount: 1,
          archiveReason: "ADMIN_DELETE",
          archivedStudentId: "arch-1",
          deletionRequestId: null,
        }),
      },
    })
    expect(prismaMock.student.delete).toHaveBeenCalledWith({
      where: { id: "stu-1" },
    })
  })

  it("saves a student mark for an in-scope admin workspace view", async () => {
    prismaMock.assessment.findFirst.mockResolvedValue({
      id: "assess-1",
      offeringId: "off-1",
      maxMarks: 50,
    })
    prismaMock.student.findUnique.mockResolvedValue({ sectionId: "sec-a" })

    const { saveAdminStudentMark } = await import("@/app/dashboard/students/actions")

    await expect(saveAdminStudentMark("stu-1", "assess-1", 42)).resolves.toEqual({ success: true })
    expect(prismaMock.mark.upsert).toHaveBeenCalledWith({
      where: { studentId_assessmentId: { studentId: "stu-1", assessmentId: "assess-1" } },
      update: { marks: 42 },
      create: { studentId: "stu-1", assessmentId: "assess-1", marks: 42 },
    })
  })
})
