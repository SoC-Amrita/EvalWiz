import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"

import { getAdvancedAnalyticsDetailData } from "@/app/dashboard/advanced-analytics/data"
import { getReportsDetailData } from "@/app/dashboard/reports/data"

import { StemLeafExplorerPage } from "../stem-leaf-views"

export default async function GradingStemLeafPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const [analyticsDetail, reportDetail] = await Promise.all([
    getAdvancedAnalyticsDetailData(),
    getReportsDetailData(),
  ])

  return (
    <StemLeafExplorerPage
      points={reportDetail.finalMarkStemData}
      sections={analyticsDetail.sections}
      subjectLabel={`${analyticsDetail.exportMeta.subjectCode} - ${analyticsDetail.exportMeta.subjectTitle}`}
    />
  )
}
