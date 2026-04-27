import { describe, expect, it } from "vitest"

import { buildDashboardAuditLogWhere } from "./audit-log-scope"

describe("dashboard audit log scope", () => {
  it("allows admins to see global dashboard audit activity", () => {
    expect(buildDashboardAuditLogWhere({ id: "admin-1", isAdmin: true })).toEqual({})
  })

  it("limits non-admin users to their own dashboard audit activity", () => {
    expect(buildDashboardAuditLogWhere({ id: "faculty-1", isAdmin: false })).toEqual({
      userId: "faculty-1",
    })
    expect(buildDashboardAuditLogWhere({ id: "faculty-2" })).toEqual({
      userId: "faculty-2",
    })
  })
})
