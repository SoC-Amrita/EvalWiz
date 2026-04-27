"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BarChart3, LineChart, Table2, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

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
      "border-[color:var(--chart-2)]/70 bg-[color:var(--chart-2)]/12 text-foreground shadow-md ring-1 ring-[color:var(--chart-2)]/35",
  },
  advanced: {
    icon: LineChart,
    accentClassName: "text-[color:var(--chart-8)]",
    activeClassName:
      "border-[color:var(--chart-8)]/70 bg-[color:var(--chart-8)]/12 text-foreground shadow-md ring-1 ring-[color:var(--chart-8)]/35",
  },
  reports: {
    icon: Table2,
    accentClassName: "text-[color:var(--chart-6)]",
    activeClassName:
      "border-[color:var(--chart-6)]/70 bg-[color:var(--chart-6)]/12 text-foreground shadow-md ring-1 ring-[color:var(--chart-6)]/35",
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

  const selectTab = (nextTab: AnalyticsWorkspaceTab) => {
    setActiveTab(nextTab)
    syncTabToUrl(nextTab)
  }

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Course analytics views"
        className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {(Object.keys(TAB_LABELS) as AnalyticsWorkspaceTab[]).map((tab) => {
          const { icon: Icon, accentClassName, activeClassName } = TAB_META[tab]
          const isActive = activeTab === tab

          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tab}-analytics-panel`}
              id={`${tab}-analytics-tab`}
              onClick={() => selectTab(tab)}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-md border border-border/55 bg-muted/30 px-3 py-2.5 text-left text-muted-foreground transition",
                "hover:border-border hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive && activeClassName
              )}
            >
              <span className="flex w-full items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-current/10 bg-background",
                    accentClassName
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                  {TAB_LABELS[tab]}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`${activeTab}-analytics-panel`}
        aria-labelledby={`${activeTab}-analytics-tab`}
        className="space-y-6"
      >
        {activeTab === "course" ? <AnalyticsClient data={componentStats} /> : null}

        {activeTab === "advanced" ? (
          <AdvancedAnalyticsShell
            summary={advancedSummary}
            loadDetailsAction={loadAdvancedDetailsAction}
          />
        ) : null}

        {activeTab === "reports" ? (
          <ReportsClient
            data={reportData}
            courseAggregate={courseAggregate}
            reportMeta={reportMeta}
            loadDetailsAction={loadReportDetailsAction}
          />
        ) : null}
      </div>
    </div>
  )
}
