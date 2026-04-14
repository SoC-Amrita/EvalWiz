"use server"

import { revalidatePath } from "next/cache"

import prisma from "@/lib/db"
import {
  sanitizeGradeRuleConfig,
  serializeGradeRuleConfig,
  validateGradeRuleConfig,
  type GradeRuleConfig,
} from "@/lib/grade-rules"
import { requireAuthenticatedWorkspaceState, requireRealWorkspace } from "@/lib/workspace-guards"

import { getAdvancedAnalyticsDetailData } from "./data"

export async function loadAdvancedAnalyticsDetailData() {
  return getAdvancedAnalyticsDetailData()
}

export async function saveAdvancedAnalyticsGradeRules(config: GradeRuleConfig) {
  const { activeWorkspace, activeRoleView } = await requireAuthenticatedWorkspaceState()
  requireRealWorkspace(activeWorkspace)

  if (activeRoleView !== "mentor") {
    throw new Error("Only mentors can update grade rules for this course workspace.")
  }

  const sanitized = sanitizeGradeRuleConfig(config)
  const issues = validateGradeRuleConfig(sanitized)
  if (issues.length > 0) {
    throw new Error(issues[0].message)
  }

  await prisma.$executeRaw`
    UPDATE "CourseOffering"
    SET "gradeRulesConfig" = ${serializeGradeRuleConfig(sanitized)}
    WHERE "id" = ${activeWorkspace.offeringId}
  `

  revalidatePath("/dashboard/advanced-analytics")
  revalidatePath("/dashboard/grading")

  return {
    gradeRuleConfig: sanitized,
  }
}
