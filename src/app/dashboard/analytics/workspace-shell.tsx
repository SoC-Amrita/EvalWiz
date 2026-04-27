"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { AdvancedAnalyticsShell } from "../advanced-analytics/shell"
import { ReportsClient } from "../reports/client"
import { AnalyticsClient } from "./client"

export type AnalyticsWorkspaceTab = "course" | "advanced" | "reports"

type ComponentStat = Parameters<typeof AnalyticsClient>[0]["data"][number]
type AdvancedAnalyticsSummary = Parameters<typeof AdvancedAnalyticsShell>[0]["summary"]
type ReportsClientProps = Parameters<typeof ReportsClient>[0]
type LoadAdvancedDetailsAction = Parameters<typeof AdvancedAnalyticsShell>[0]["loadDetailsAction"]
type LoadReportDetailsAction = ReportsClientProps["loadDetailsAction"]

const TAB_LABELS: Record<AnalyticsWorkspaceTab, string> = {
  course: "Course Analytics",
  advanced: "Advanced Analytics",
  reports: "Section Reports",
}

export function AnalyticsWorkspaceShell({
  initialTab,
  componentStats,
  advancedSummary,
  reportData,
  courseAggregate,
  reportMeta,
  loadAdvancedDetailsAction,
  loadReportDetailsAction,
}: {
  initialTab: AnalyticsWorkspaceTab
  componentStats: ComponentStat[]
  advancedSummary: AdvancedAnalyticsSummary
  reportData: ReportsClientProps["data"]
  courseAggregate: ReportsClientProps["courseAggregate"]
  reportMeta: ReportsClientProps["reportMeta"]
  loadAdvancedDetailsAction: LoadAdvancedDetailsAction
  loadReportDetailsAction: LoadReportDetailsAction
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<AnalyticsWorkspaceTab>(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const syncTabToUrl = (nextTab: AnalyticsWorkspaceTab) => {
    const params = new URLSearchParams(searchParams.toString())

    if (nextTab === "course") {
      params.delete("tab")
    } else {
      params.set("tab", nextTab)
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        const nextTab = value as AnalyticsWorkspaceTab
        setActiveTab(nextTab)
        syncTabToUrl(nextTab)
      }}
      className="space-y-6"
    >
      <TabsList>
        <TabsTrigger value="course">{TAB_LABELS.course}</TabsTrigger>
        <TabsTrigger value="advanced">{TAB_LABELS.advanced}</TabsTrigger>
        <TabsTrigger value="reports">{TAB_LABELS.reports}</TabsTrigger>
      </TabsList>

      <TabsContent value="course" className="space-y-6">
        <AnalyticsClient data={componentStats} />
      </TabsContent>

      <TabsContent value="advanced" className="space-y-6">
        <AdvancedAnalyticsShell
          summary={advancedSummary}
          loadDetailsAction={loadAdvancedDetailsAction}
        />
      </TabsContent>

      <TabsContent value="reports" className="space-y-6">
        <ReportsClient
          data={reportData}
          courseAggregate={courseAggregate}
          reportMeta={reportMeta}
          loadDetailsAction={loadReportDetailsAction}
        />
      </TabsContent>
    </Tabs>
  )
}
