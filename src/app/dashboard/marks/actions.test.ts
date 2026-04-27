import { beforeEach, describe, expect, it, vi } from "vitest"

const revalidatePathMock = vi.fn()
const requireAllowedSectionAccessMock = vi.fn()
const requireRealWorkspaceMock = vi.fn()

const prismaMock = {
  courseOfferingEnrollment: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  student: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  assessment: {
    findFirst: vi.fn(),
  },
  mark: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock("@/lib/db", () => ({
  default: prismaMock,
}))

vi.mock("@/lib/workspace-guards", () => ({
  requireAllowedSectionAccess: requireAllowedSectionAccessMock,
  requireRealWorkspace: requireRealWorkspaceMock,
}))

describe("marks actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAllowedSectionAccessMock.mockResolvedValue({
      user: { id: "faculty-1", name: "Dr. Malathi", isAdmin: false },
      activeWorkspace: { offeringId: "off-1", isElective: false },
      allowedSectionIds: new Set(["sec-a"]),
    })
    prismaMock.$transaction.mockResolvedValue([])
  })

  it("blocks saving marks for an out-of-scope student", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null)

    const { saveStudentMark } = await import("@/app/dashboard/marks/actions")

    await expect(saveStudentMark("stu-1", "assess-1", "23")).rejects.toThrow(
      "Unauthorized to edit out-of-scope student"
    )
  })

  it("rejects non-finite marks before writing", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "stu-1" })

    const { saveStudentMark } = await import("@/app/dashboard/marks/actions")

    await expect(saveStudentMark("stu-1", "assess-1", "Infinity")).rejects.toThrow("Invalid mark")
    expect(prismaMock.mark.upsert).not.toHaveBeenCalled()
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
  })

  it("handles bulk uploads with mixed success and error rows", async () => {
    prismaMock.assessment.findFirst.mockResolvedValue({
      id: "assess-1",
      offeringId: "off-1",
      code: "Q1",
      name: "Quiz 1",
      maxMarks: 20,
    })
    prismaMock.student.findMany.mockResolvedValue([
      { id: "stu-1", rollNo: "CB.SC.U4CSE23001" },
    ])

    const { bulkUploadMarks } = await import("@/app/dashboard/marks/actions")

    const result = await bulkUploadMarks("sec-a", "assess-1", [
      { rollNo: "CB.SC.U4CSE23001", marks: 18 },
      { rollNo: "CB.SC.U4CSE23002", marks: 17 },
      { rollNo: "CB.SC.U4CSE23003", marks: 25 },
    ])

    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      prismaMock.mark.deleteMany.mock.results[0]?.value,
      prismaMock.mark.createMany.mock.results[0]?.value,
    ])
    expect(prismaMock.mark.createMany).toHaveBeenCalledWith({
      data: [
        {
          studentId: "stu-1",
          assessmentId: "assess-1",
          marks: 18,
        },
      ],
    })
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "BULK_MARK_UPLOAD",
        userId: "faculty-1",
        details: JSON.stringify({
          type: "bulk",
          sectionId: "sec-a",
          assessmentId: "assess-1",
          offeringId: "off-1",
          assessmentCode: "Q1",
          assessmentName: "Quiz 1",
          successCount: 1,
          errorCount: 2,
          userName: "Dr. Malathi",
        }),
      },
    })
    expect(result).toEqual({
      success: true,
      successCount: 1,
      errorCount: 2,
      errors: [
        "Row CB.SC.U4CSE23002: Student not found in this section",
        "Row CB.SC.U4CSE23003: Mark 25 out of bounds (0-20)",
      ],
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/marks")
  })
})
