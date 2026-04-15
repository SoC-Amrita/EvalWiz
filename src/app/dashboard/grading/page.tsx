import { auth } from "@/auth"
import { redirect } from "next/navigation"

import { saveAdvancedAnalyticsGradeRules } from "@/app/dashboard/advanced-analytics/actions"
import { getAdvancedAnalyticsDetailData } from "@/app/dashboard/advanced-analytics/data"
import { getReportsDetailData } from "@/app/dashboard/reports/data"

import { GradingClient } from "./client"

export default async function GradingPage() {
  const session = await auth()
  const user = session?.user
  if (!user) redirect("/login")

  const [analyticsDetail, reportDetail] = await Promise.all([
    getAdvancedAnalyticsDetailData(),
    getReportsDetailData(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Grading</h1>
        <p className="text-slate-500">
          Centralized grading analytics, mentor-managed grade publishing, and final-score review for{" "}
          {analyticsDetail.exportMeta.subjectCode} - {analyticsDetail.exportMeta.subjectTitle}.
        </p>
      </div>

      <GradingClient
        exportMeta={analyticsDetail.exportMeta}
        sections={analyticsDetail.sections}
        finalMarkStemData={reportDetail.finalMarkStemData}
        gradingReportSections={reportDetail.gradingReportSections}
        gradingWeights={reportDetail.gradingWeights}
        activeRoleView={analyticsDetail.activeRoleView}
        canEditGradeRules={analyticsDetail.canEditGradeRules}
        initialGradeRuleConfig={analyticsDetail.gradeRuleConfig}
        saveGradeRulesAction={saveAdvancedAnalyticsGradeRules}
      />
    </div>
  )
}
