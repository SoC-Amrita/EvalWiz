import { beforeEach, describe, expect, it, vi } from "vitest"

const getReportsDetailDataMock = vi.fn()

vi.mock("@/app/dashboard/reports/data", () => ({
  getReportsDetailData: getReportsDetailDataMock,
}))

describe("reports actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("loads reports detail data through the data loader", async () => {
    getReportsDetailDataMock.mockResolvedValue({ meta: { title: "Reports" } })

    const { loadReportsDetailData } = await import("@/app/dashboard/reports/actions")

    await expect(loadReportsDetailData()).resolves.toEqual({ meta: { title: "Reports" } })
    expect(getReportsDetailDataMock).toHaveBeenCalledTimes(1)
  })
})
