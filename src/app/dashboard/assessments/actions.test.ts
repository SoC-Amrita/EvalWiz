import { beforeEach, describe, expect, it, vi } from "vitest"

const revalidatePathMock = vi.fn()
const requireRealWorkspaceMock = vi.fn()
const requireWorkspaceManagerStateMock = vi.fn()

const prismaMock = {
  assessment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock("@/lib/workspace-guards", () => ({
  requireRealWorkspace: requireRealWorkspaceMock,
  requireWorkspaceManagerState: requireWorkspaceManagerStateMock,
}))

vi.mock("@/lib/db", () => ({
  default: prismaMock,
}))

describe("assessment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireWorkspaceManagerStateMock.mockResolvedValue({
      activeWorkspace: { offeringId: "off-1" },
    })
  })

  it("creates assessments inside the active offering", async () => {
    const { createAssessment } = await import("@/app/dashboard/assessments/actions")

    await expect(
      createAssessment({
        name: "Quiz 1",
        code: "Q1",
        description: "Intro quiz",
        maxMarks: 20,
        weightage: 5,
        category: "CA_QUIZ",
        isActive: true,
        includeInAgg: true,
        displayOrder: 1,
      })
    ).resolves.toEqual({ success: true })

    expect(prismaMock.assessment.create).toHaveBeenCalledWith({
      data: {
        name: "Quiz 1",
        code: "Q1",
        description: "Intro quiz",
        maxMarks: 20,
        weightage: 5,
        category: "CA_QUIZ",
        isActive: true,
        includeInAgg: true,
        displayOrder: 1,
        offeringId: "off-1",
      },
    })
  })

  it("blocks status toggles for assessments outside the active workspace", async () => {
    prismaMock.assessment.findFirst.mockResolvedValue(null)

    const { toggleAssessmentStatus } = await import("@/app/dashboard/assessments/actions")

    await expect(toggleAssessmentStatus("assess-1", true)).rejects.toThrow(
      "Assessment not found in the active workspace"
    )
    expect(prismaMock.assessment.update).not.toHaveBeenCalled()
  })

  it("deletes assessments that belong to the active workspace", async () => {
    prismaMock.assessment.findFirst.mockResolvedValue({ id: "assess-1" })

    const { deleteAssessment } = await import("@/app/dashboard/assessments/actions")

    await expect(deleteAssessment("assess-1")).resolves.toEqual({ success: true })
    expect(prismaMock.assessment.delete).toHaveBeenCalledWith({
      where: { id: "assess-1" },
    })
  })
})
