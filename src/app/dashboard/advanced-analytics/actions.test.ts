import { beforeEach, describe, expect, it, vi } from "vitest"

const revalidatePathMock = vi.fn()
const courseOfferingUpdateMock = vi.fn()
const requireAuthenticatedWorkspaceStateMock = vi.fn()
const requireRealWorkspaceMock = vi.fn()
const getAdvancedAnalyticsDetailDataMock = vi.fn()
const collapseGradeRuleConfigToActiveRuleMock = vi.fn()
const serializeGradeRuleConfigMock = vi.fn()
const validateGradeRuleConfigMock = vi.fn()

const prismaMock = {
  courseOffering: {
    update: courseOfferingUpdateMock,
  },
}

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock("@/lib/db", () => ({
  default: prismaMock,
}))

vi.mock("@/lib/workspace-guards", () => ({
  requireAuthenticatedWorkspaceState: requireAuthenticatedWorkspaceStateMock,
  requireRealWorkspace: requireRealWorkspaceMock,
}))

vi.mock("@/lib/grade-rules", () => ({
  collapseGradeRuleConfigToActiveRule: collapseGradeRuleConfigToActiveRuleMock,
  serializeGradeRuleConfig: serializeGradeRuleConfigMock,
  validateGradeRuleConfig: validateGradeRuleConfigMock,
}))

vi.mock("@/app/dashboard/advanced-analytics/data", () => ({
  getAdvancedAnalyticsDetailData: getAdvancedAnalyticsDetailDataMock,
}))

describe("advanced analytics actions", () => {
  const gradeRuleConfig = {
    selectedRuleId: "rule-1",
    rules: [
      {
        id: "rule-1",
        name: "Default",
        bands: [
          { id: "a", label: "A", minScore: 80 },
          { id: "b", label: "B", minScore: 60 },
        ],
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    requireAuthenticatedWorkspaceStateMock.mockResolvedValue({
      activeWorkspace: { offeringId: "off-1" },
      activeRoleView: "mentor",
    })
    collapseGradeRuleConfigToActiveRuleMock.mockImplementation((config) => config)
    serializeGradeRuleConfigMock.mockReturnValue('{"rules":[]}')
    validateGradeRuleConfigMock.mockReturnValue([])
  })

  it("loads advanced analytics detail data through the data loader", async () => {
    getAdvancedAnalyticsDetailDataMock.mockResolvedValue({ summary: { totalStudents: 42 } })

    const { loadAdvancedAnalyticsDetailData } = await import("@/app/dashboard/advanced-analytics/actions")

    await expect(loadAdvancedAnalyticsDetailData()).resolves.toEqual({ summary: { totalStudents: 42 } })
    expect(getAdvancedAnalyticsDetailDataMock).toHaveBeenCalledTimes(1)
  })

  it("allows only mentors to update grade rules", async () => {
    requireAuthenticatedWorkspaceStateMock.mockResolvedValue({
      activeWorkspace: { offeringId: "off-1" },
      activeRoleView: "faculty",
    })

    const { saveAdvancedAnalyticsGradeRules } = await import("@/app/dashboard/advanced-analytics/actions")

    await expect(saveAdvancedAnalyticsGradeRules(gradeRuleConfig)).rejects.toThrow(
      "Only mentors can update grade rules"
    )
    expect(courseOfferingUpdateMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it("validates and persists mentor grade rules", async () => {
    const { saveAdvancedAnalyticsGradeRules } = await import("@/app/dashboard/advanced-analytics/actions")

    await expect(saveAdvancedAnalyticsGradeRules(gradeRuleConfig)).resolves.toEqual({
      gradeRuleConfig,
    })
    expect(requireRealWorkspaceMock).toHaveBeenCalledWith({ offeringId: "off-1" })
    expect(collapseGradeRuleConfigToActiveRuleMock).toHaveBeenCalledWith(gradeRuleConfig)
    expect(validateGradeRuleConfigMock).toHaveBeenCalledWith(gradeRuleConfig)
    expect(courseOfferingUpdateMock).toHaveBeenCalledWith({
      where: { id: "off-1" },
      data: { gradeRulesConfig: '{"rules":[]}' },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/advanced-analytics")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/grading")
  })

  it("rejects invalid grade rules before writing", async () => {
    validateGradeRuleConfigMock.mockReturnValue([{ message: "Grade bands overlap" }])

    const { saveAdvancedAnalyticsGradeRules } = await import("@/app/dashboard/advanced-analytics/actions")

    await expect(saveAdvancedAnalyticsGradeRules(gradeRuleConfig)).rejects.toThrow("Grade bands overlap")
    expect(courseOfferingUpdateMock).not.toHaveBeenCalled()
  })
})
