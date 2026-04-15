import { auth } from "@/auth"
import { redirect } from "next/navigation"

import { loadAdvancedAnalyticsDetailData } from "./actions"
import { getAdvancedAnalyticsSummaryData } from "./data"
import { AdvancedAnalyticsShell } from "./shell"

export default async function AdvancedAnalyticsPage() {
  const session = await auth()
  const user = session?.user
  if (!user) redirect("/login")

  const summary = await getAdvancedAnalyticsSummaryData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Advanced Analytics</h1>
      </div>

      <AdvancedAnalyticsShell
        summary={summary}
        loadDetailsAction={loadAdvancedAnalyticsDetailData}
      />
    </div>
  )
}
