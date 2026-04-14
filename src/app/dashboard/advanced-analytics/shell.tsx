"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { AdvancedAnalyticsClient } from "./client"
import type { AdvancedAnalyticsSummary } from "./types"

type DetailData = Awaited<ReturnType<typeof import("./actions").loadAdvancedAnalyticsDetailData>>

export function AdvancedAnalyticsShell({
  summary,
  loadDetailsAction,
}: {
  summary: AdvancedAnalyticsSummary
  loadDetailsAction: () => Promise<DetailData>
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "charts">("overview")
  const [detailData, setDetailData] = useState<DetailData | null>(null)
  const [isLoadingDetails, startLoadingDetails] = useTransition()

  const ensureDetailsLoaded = () => {
    if (detailData || isLoadingDetails) return

    startLoadingDetails(async () => {
      const nextData = await loadDetailsAction()
      setDetailData(nextData)
    })
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        const nextTab = value as "overview" | "charts"
        setActiveTab(nextTab)
        if (nextTab === "charts") {
          ensureDetailsLoaded()
        }
      }}
      className="space-y-6"
    >
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="charts">Charts Workspace</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Students in scope" value={summary.totalStudents.toLocaleString()} helper="Active students included in analytics" />
          <SummaryCard label="Visible sections" value={summary.totalSections.toLocaleString()} helper="Sections available in this workspace" />
          <SummaryCard label="Active components" value={summary.totalAssessments.toLocaleString()} helper="Assessment components in the selected offering" />
          <SummaryCard label="Recorded marks" value={summary.totalMarks.toLocaleString()} helper="Mark rows available for deep analysis" />
        </div>

        <Card className="border-slate-200 dark:border-slate-800 bg-white shadow-sm dark:bg-slate-900">
          <CardHeader>
            <CardTitle>Analysis Scope</CardTitle>
            <CardDescription>
              This summary loads first so the page stays responsive. Open the charts workspace only when you want the full raw-mark visual analysis tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="grid gap-3 md:grid-cols-2">
              <MetaLine label="Subject" value={`${summary.exportMeta.subjectCode} · ${summary.exportMeta.subjectTitle}`} />
              <MetaLine label="Program" value={summary.exportMeta.program} />
              <MetaLine label="Academic Year" value={summary.exportMeta.academicYear} />
              <MetaLine label="Term" value={summary.exportMeta.term} />
              <MetaLine label="Semester" value={summary.exportMeta.semester} />
              <MetaLine label="Course Type" value={summary.exportMeta.courseType} />
              <MetaLine label="Evaluation Pattern" value={summary.exportMeta.evaluationPattern} />
              <MetaLine label="Mentors" value={summary.mentorNames.join(", ") || "Not assigned"} />
            </div>

            <Button
              onClick={() => {
                setActiveTab("charts")
                ensureDetailsLoaded()
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={isLoadingDetails}
            >
              {isLoadingDetails ? "Loading charts workspace..." : "Open Charts Workspace"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="charts" className="space-y-6">
        {detailData ? (
          <AdvancedAnalyticsClient
            rawMarks={detailData.rawMarks}
            assessments={detailData.assessments}
            sections={detailData.sections}
            exportMeta={detailData.exportMeta}
          />
        ) : (
          <Card className="border-dashed border-slate-300 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/60">
            <CardHeader>
              <CardTitle>Charts Workspace</CardTitle>
              <CardDescription>
                The full advanced analytics workspace loads raw marks, section comparisons, and chart-ready datasets on demand.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={ensureDetailsLoaded}
                disabled={isLoadingDetails}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isLoadingDetails ? "Loading charts workspace..." : "Load Charts Workspace"}
              </Button>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  )
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white shadow-sm dark:bg-slate-900">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {value}
        </div>
        <p className="mt-1 text-xs text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  )
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/30">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  )
}
