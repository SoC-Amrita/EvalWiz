import { auth } from "@/auth"
import { redirect } from "next/navigation"

import { loadReportsDetailData } from "./actions"
import { ReportsClient } from "./client"
import { getReportsSummaryData } from "./data"

export default async function ReportsPage() {
  const session = await auth()
  const user = session?.user
  if (!user) redirect("/login")

  const { reportData, courseAggregate, reportMeta } = await getReportsSummaryData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Consolidated Section Reports
        </h1>
        <p className="text-slate-500">
          Structured statistical reporting for {reportMeta.subjectCode} - {reportMeta.subjectTitle}.
        </p>
      </div>

      <ReportsClient
        data={reportData}
        courseAggregate={courseAggregate}
        reportMeta={reportMeta}
        loadDetailsAction={loadReportsDetailData}
      />
    </div>
  )
}
