"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BarChart3, LineChart, Table2, type LucideIcon } from "lucide-react"

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

const TAB_META: Record<
  AnalyticsWorkspaceTab,
  {
    icon: LucideIcon
    accentClassName: string
    activeClassName: string
  }
> = {
  course: {
    icon: BarChart3,
    accentClassName: "text-[color:var(--chart-2)]",
    activeClassName:
      "data-active:border-[color:var(--chart-2)]/30 data-active:bg-gradient-to-br data-active:from-[color:var(--chart-2)]/12 data-active:to-primary/6",
  },
  advanced: {
    icon: LineChart,
    accentClassName: "text-[color:var(--chart-8)]",
    activeClassName:
      "data-active:border-[color:var(--chart-8)]/30 data-active:bg-gradient-to-br data-active:from-[color:var(--chart-8)]/12 data-active:to-primary/6",
  },
  reports: {
    icon: Table2,
    accentClassName: "text-[color:var(--chart-6)]",
    activeClassName:
      "data-active:border-[color:var(--chart-6)]/30 data-active:bg-gradient-to-br data-active:from-[color:var(--chart-6)]/12 data-active:to-primary/6",
  },
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
      <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl border border-border/80 bg-gradient-to-r from-background via-accent/20 to-background p-2 shadow-sm sm:grid-cols-3">
        {(Object.keys(TAB_LABELS) as AnalyticsWorkspaceTab[]).map((tab) => {
          const { icon: Icon, accentClassName, activeClassName } = TAB_META[tab]

          return (
            <TabsTrigger
              key={tab}
              value={tab}
              className={`h-auto min-h-[72px] justify-start rounded-xl border border-transparent px-4 py-3 text-left after:hidden hover:border-border/70 hover:bg-background/80 ${activeClassName}`}
            >
              <span className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl border border-current/10 bg-background/85 shadow-sm ${accentClassName}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex flex-col items-start">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    View
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {TAB_LABELS[tab]}
                  </span>
                </span>
              </span>
            </TabsTrigger>
          )
        })}
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
