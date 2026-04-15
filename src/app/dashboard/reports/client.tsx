"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { classifyAssessment, REPORT_METRICS } from "@/lib/assessment-structure"
import { CHART_THEME, METRIC_COLOR_MAP, getSectionColor } from "@/lib/chart-theme"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { AssessmentComponentReport, FinalMarkStemPoint, ReportMeta, SectionReportData } from "./types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Download, FileText, BookOpen } from "lucide-react"
import { captureElementAsImage } from "@/lib/pdf-export"
import React, { useMemo, useState, useTransition } from "react"
import jsPDF from "jspdf"
import { toast } from "sonner"

type StemLeafUnit = 1 | 0.5
type StemLeafSortMode = "score" | "section"
type HighlightRangeKey = "ALL" | "LT50" | "50_59" | "60_69" | "70_79" | "80_89" | "GE90"

const STEM_LEAF_HIGHLIGHT_RANGES: Array<{ key: HighlightRangeKey; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "LT50", label: "<50" },
  { key: "50_59", label: "50-59" },
  { key: "60_69", label: "60-69" },
  { key: "70_79", label: "70-79" },
  { key: "80_89", label: "80-89" },
  { key: "GE90", label: "90+" },
]
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from "recharts"

const REPORT_VISUAL_EXPORT_ID = "report-visual-export"
const FINAL_MARKS_STEM_EXPORT_ID = "final-marks-stem-chart-export"
const REPORT_FONT_FAMILY = "georgia-report"
const REPORT_FONT_STACK = "\"Georgia PDF\", Georgia, \"Iowan Old Style\", \"Palatino Linotype\", \"Times New Roman\", serif"

let reportFontRegistrationPromise: Promise<void> | null = null

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ""

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

async function registerReportFonts(pdf: jsPDF) {
  if (reportFontRegistrationPromise) {
    await reportFontRegistrationPromise
    return
  }

  reportFontRegistrationPromise = (async () => {
    const [regularResponse, boldResponse] = await Promise.all([
      fetch("/fonts/Georgia.ttf"),
      fetch("/fonts/Georgia-Bold.ttf"),
    ])

    if (!regularResponse.ok || !boldResponse.ok) {
      throw new Error("Unable to load Georgia report fonts")
    }

    const [regularBuffer, boldBuffer] = await Promise.all([
      regularResponse.arrayBuffer(),
      boldResponse.arrayBuffer(),
    ])

    pdf.addFileToVFS("Georgia.ttf", arrayBufferToBase64(regularBuffer))
    pdf.addFont("Georgia.ttf", REPORT_FONT_FAMILY, "normal")
    pdf.addFileToVFS("Georgia-Bold.ttf", arrayBufferToBase64(boldBuffer))
    pdf.addFont("Georgia-Bold.ttf", REPORT_FONT_FAMILY, "bold")
  })()

  await reportFontRegistrationPromise
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

// ─── Report Config Dialog ──────────────────────────────────────────────────

function ReportVisualSummary({
  rows,
  isCourse,
}: {
  rows: SectionReportData[]
  isCourse: boolean
}) {
  const componentChartData = REPORT_METRICS.map((metric) => ({
    name: metric.shortLabel,
    value: Number(average(rows.map((row) => row[metric.key].avg)).toFixed(1)),
    fill: metric.color,
  }))

  const sectionChartData = isCourse
    ? rows.map((row) => ({
        name: row.sectionName,
        value: Number(row.overall.avg.toFixed(1)),
      }))
    : REPORT_METRICS.map((metric) => ({
        name: metric.shortLabel,
        value: Number(rows[0]?.[metric.key].avg.toFixed(1) ?? 0),
      }))

  return (
    <div
      id={REPORT_VISUAL_EXPORT_ID}
      style={{
        width: 880,
        backgroundColor: "#ffffff",
        padding: 16,
        boxSizing: "border-box",
        fontFamily: REPORT_FONT_STACK,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
            Weighted Mean by Component
          </div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={componentChartData} margin={{ top: 8, right: 12, left: -12, bottom: 14 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.16} />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <RechartsTooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {componentChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
            {isCourse ? "Section-wise Overall Mean" : "Section Snapshot by Component"}
          </div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectionChartData} margin={{ top: 8, right: 12, left: -12, bottom: 14 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.16} />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <RechartsTooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportConfigDialog({
  data,
  courseAggregate,
  reportMeta,
  open,
  onClose,
}: {
  data: SectionReportData[]
  courseAggregate: SectionReportData | null
  reportMeta: ReportMeta
  open: boolean
  onClose: () => void
}) {
  const [scope, setScope] = useState<"course" | "section">(courseAggregate ? "course" : "section")
  const [selectedSectionId, setSelectedSectionId] = useState(data[0]?.sectionId ?? "")
  const [isGenerating, setIsGenerating] = useState(false)

  const printContainerId = REPORT_VISUAL_EXPORT_ID

  // Rows to render in the template
  const rowsToRender: SectionReportData[] =
    scope === "course" ? data : data.filter(r => r.sectionId === selectedSectionId)

  const handleGenerate = async () => {
    setIsGenerating(true)
    const date = new Date().toISOString().split("T")[0]
    const reportTitle =
      scope === "course"
        ? "Consolidated Course Performance Report"
        : "Section Performance Report"
    const name = scope === "course"
      ? `${reportMeta.appName}_${reportMeta.subjectCode}_Course_Report_${date}.pdf`
      : `${reportMeta.appName}_${reportMeta.subjectCode}_${rowsToRender[0]?.sectionName.replace(/\s+/g, "_")}_Report_${date}.pdf`

    try {
      await new Promise(res => setTimeout(res, 200))
      const { imgData, width, height } = await captureElementAsImage(printContainerId, {
        pixelRatio: 2.5,
        forcePaletteTheme: "aurora",
        forceSerifFont: true,
      })

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: "a4",
      })
      try {
        await registerReportFonts(pdf)
      } catch (error) {
        console.error("Georgia font registration failed, falling back to Times:", error)
      }
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 28
      const contentWidth = pageWidth - margin * 2
      let pageNumber = 1

      const drawHeader = (title: string) => {
        pdf.setFillColor(255, 247, 237)
        pdf.rect(0, 0, pageWidth, 92, "F")
        pdf.setDrawColor(79, 70, 229)
        pdf.setLineWidth(2)
        pdf.line(margin, 88, pageWidth - margin, 88)

        pdf.setFont(REPORT_FONT_FAMILY, "bold")
        pdf.setFontSize(9)
        pdf.setTextColor(99, 102, 241)
        pdf.text(reportMeta.appName.toUpperCase(), margin, 24)

        pdf.setFontSize(13)
        pdf.setTextColor(159, 18, 57)
        pdf.text(title.toUpperCase(), pageWidth - margin, 24, { align: "right" })

        pdf.setFontSize(13)
        pdf.setTextColor(15, 23, 42)
        pdf.text(reportMeta.school, margin, 48)

        pdf.setFontSize(11)
        pdf.text(reportMeta.department, margin, 62)

        pdf.setFontSize(15)
        pdf.text(reportMeta.institution, margin, 78)
      }

      const drawFooter = () => {
        pdf.setFont(REPORT_FONT_FAMILY, "normal")
        pdf.setFontSize(10)
        pdf.setTextColor(100, 116, 139)
        pdf.text(`${reportMeta.subjectCode} · ${reportMeta.subjectTitle}`, margin, pageHeight - 14)
        pdf.text(`Page ${pageNumber}`, pageWidth / 2, pageHeight - 14, { align: "center" })
        pdf.text(`Developed by ${reportMeta.developer}`, pageWidth - margin, pageHeight - 14, { align: "right" })
      }

      drawHeader(reportTitle)

      const metaItems = [
        ["Subject Code", reportMeta.subjectCode],
        ["Subject", reportMeta.subjectTitle],
        ["Academic Year", reportMeta.academicYear],
        ["Term", reportMeta.term],
        ["Course", reportMeta.course],
        ["Year", reportMeta.year],
        ["Course Type", reportMeta.courseType],
        ["Evaluation Pattern", reportMeta.evaluationPattern],
        ["Semester No.", reportMeta.semester],
        scope === "course"
          ? ["No. of Sections", String(rowsToRender.length)]
          : ["No. of Sections", "1"],
        [null, null],
        [
          "Section / Group",
          scope === "course" ? "All Sections" : rowsToRender[0]?.sectionName ?? "—",
        ],
      ]

      const metaColumns = 3
      const metaGapX = 18
      const metaGapY = 8
      const metaColumnWidth = (contentWidth - metaGapX * (metaColumns - 1)) / metaColumns
      const metaStartY = 112
      let metaCursorY = metaStartY
      for (let index = 0; index < metaItems.length; index += metaColumns) {
        const rowItems = metaItems.slice(index, index + metaColumns)
        const rowMetrics = rowItems.map(([label, value]) => {
          const hasLabel = typeof label === "string" && label.trim().length > 0
          if (!hasLabel) {
            return {
              hasLabel,
              labelText: "",
              labelWidth: 0,
              valueLines: [] as string[],
              lineCount: 1,
            }
          }
          pdf.setFont(REPORT_FONT_FAMILY, "bold")
          pdf.setFontSize(10)
          const labelText = `${String(label)}: `
          const labelWidth = pdf.getTextWidth(labelText)
          const availableValueWidth = Math.max(metaColumnWidth - labelWidth - 4, 48)
          pdf.setFont(REPORT_FONT_FAMILY, "normal")
          pdf.setFontSize(10)
          const valueLines = pdf.splitTextToSize(String(value), availableValueWidth)

          return {
            hasLabel,
            labelText,
            labelWidth,
            valueLines: valueLines.slice(0, 2),
            lineCount: Math.max(1, valueLines.slice(0, 2).length),
          }
        })

        const rowHeight = Math.max(...rowMetrics.map((item) => item.lineCount)) * 11 + 2
        rowItems.forEach((_, column) => {
          const metaX = margin + column * (metaColumnWidth + metaGapX)
          const item = rowMetrics[column]
          if (!item.hasLabel) {
            return
          }
          pdf.setFont(REPORT_FONT_FAMILY, "bold")
          pdf.setFontSize(10)
          pdf.setTextColor(51, 65, 85)
          pdf.text(item.labelText, metaX, metaCursorY)
          pdf.setFont(REPORT_FONT_FAMILY, "normal")
          pdf.setTextColor(15, 23, 42)
          pdf.text(item.valueLines, metaX + item.labelWidth, metaCursorY)
        })

        metaCursorY += rowHeight + metaGapY
      }

      const drawInlineLabelValue = (label: string, value: string, x: number, y: number, width: number) => {
        pdf.setFont(REPORT_FONT_FAMILY, "bold")
        pdf.setFontSize(11)
        pdf.setTextColor(51, 65, 85)
        const labelText = `${label}: `
        pdf.text(labelText, x, y)
        const labelWidth = pdf.getTextWidth(labelText)
        pdf.setFont(REPORT_FONT_FAMILY, "normal")
        pdf.setTextColor(15, 23, 42)
        const lines = pdf.splitTextToSize(value, Math.max(width - labelWidth - 4, 48))
        pdf.text(lines, x + labelWidth, y)
        return lines.length
      }

      const mentorsLineCount = drawInlineLabelValue(
        "Mentors",
        reportMeta.mentorNames.join(", ") || "—",
        margin,
        metaCursorY + 4,
        contentWidth
      )
      const teamLabel = scope === "course" ? "Course Team" : "Course Faculty"
      const teamValue =
        scope === "course"
          ? reportMeta.courseTeamNames.join(", ") || "—"
          : rowsToRender[0]?.facultyName ?? "—"
      const teamLineY = metaCursorY + mentorsLineCount * 14 + 10
      const teamLineCount = drawInlineLabelValue(teamLabel, teamValue, margin, teamLineY, contentWidth)

      const chartTop = teamLineY + teamLineCount * 14 + 12
      const chartWidth = contentWidth
      const maxChartHeight = pageHeight - chartTop - 30
      const chartHeight = Math.min((height * chartWidth) / width, maxChartHeight)
      pdf.addImage(imgData, "PNG", margin, chartTop, contentWidth, chartHeight)

      const drawSectionTable = (startY: number, row: SectionReportData) => {
        const cardY = startY
        const cardPadding = 12
        const tableInset = 10
        const sectionHeaderHeight = 24
        const metaRowHeight = 22
        const tableHeaderHeight = 22
        const tableRowHeight = 18
        const cardHeight =
          cardPadding +
          sectionHeaderHeight +
          8 +
          metaRowHeight +
          10 +
          tableHeaderHeight +
          REPORT_METRICS.length * tableRowHeight +
          cardPadding
        const headerY = cardY + cardPadding
        const sectionLabel = row.sectionId === "ALL" ? "Course Average" : row.sectionName

        pdf.setFillColor(255, 247, 237)
        pdf.roundedRect(margin, headerY, contentWidth, sectionHeaderHeight, 10, 10, "F")
        pdf.setFont(REPORT_FONT_FAMILY, "bold")
        pdf.setFontSize(12)
        pdf.setTextColor(15, 23, 42)
        pdf.text(sectionLabel, margin + 16, headerY + 16)

        const metaTop = headerY + sectionHeaderHeight + 8
        const metaBoxWidth = (contentWidth - 16) / 3
        const metaBoxes = [
          ["Course Faculty", row.facultyName ?? "—"],
          ["Class Strength", String(row.totalStudents)],
          ["Overall Mean", `${row.overall.avg.toFixed(1)} / 100`],
        ] as const

        metaBoxes.forEach(([label, value], index) => {
          const boxX = margin + index * (metaBoxWidth + 8)
          pdf.setFillColor(248, 250, 252)
          pdf.roundedRect(boxX, metaTop, metaBoxWidth, metaRowHeight, 8, 8, "F")
          pdf.setFont(REPORT_FONT_FAMILY, "bold")
          pdf.setFontSize(8)
          pdf.setTextColor(100, 116, 139)
          pdf.text(label.toUpperCase(), boxX + 10, metaTop + 10)
          pdf.setFontSize(10)
          pdf.setTextColor(15, 23, 42)
          pdf.text(value, boxX + 10, metaTop + 18)
        })

        const columns = [
          { key: "label", title: "Component", width: 136 },
          { key: "outOf", title: "Weight", width: 60 },
          { key: "avg", title: "Mean", width: 62 },
          { key: "median", title: "Median", width: 68 },
          { key: "stdDev", title: "Std Dev", width: 72 },
          { key: "min", title: "Min", width: 68 },
          { key: "max", title: "Max", width: 68 },
        ]

        let x = margin
        const tableLeft = margin + tableInset
        const headTop = metaTop + metaRowHeight + 10
        columns.forEach((column) => {
          pdf.setDrawColor(51, 65, 85)
          pdf.setFillColor(51, 65, 85)
          pdf.roundedRect(tableLeft + (x - margin), headTop, column.width, tableHeaderHeight, 4, 4, "FD")
          pdf.setFont(REPORT_FONT_FAMILY, "bold")
          pdf.setFontSize(8.5)
          pdf.setTextColor(255, 255, 255)
          pdf.text(column.title.toUpperCase(), tableLeft + (x - margin) + column.width / 2, headTop + 14, { align: "center" })
          x += column.width
        })

        REPORT_METRICS.forEach((metric, index) => {
          const stat = row[metric.key]
          const rowTop = headTop + tableHeaderHeight + index * tableRowHeight
          let cellX = tableLeft
          const values = [
            metric.label,
            stat.outOf.toFixed(0),
            stat.avg.toFixed(2),
            stat.median.toFixed(2),
            stat.stdDev.toFixed(2),
            stat.min.toFixed(1),
            stat.max.toFixed(1),
          ]

          values.forEach((value, valueIndex) => {
            const width = columns[valueIndex].width
            if (valueIndex === 0) {
              pdf.setDrawColor(226, 232, 240)
              pdf.setFillColor(248, 250, 252)
              pdf.rect(cellX, rowTop, width, tableRowHeight, "FD")
            } else {
              pdf.setDrawColor(226, 232, 240)
              pdf.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252)
              pdf.rect(cellX, rowTop, width, tableRowHeight, "FD")
            }

            pdf.setFont(REPORT_FONT_FAMILY, valueIndex === 0 ? "bold" : "normal")
            pdf.setFontSize(8.5)
            if (valueIndex === 0) {
              pdf.setTextColor(15, 23, 42)
              pdf.text(String(value), cellX + 16, rowTop + 12)
            } else {
              pdf.setTextColor(30, 41, 59)
              pdf.text(String(value), cellX + width / 2, rowTop + 12, { align: "center" })
            }
            cellX += width
          })
        })

        return cardY + cardHeight
      }

      drawFooter()

      pdf.addPage()
      pageNumber += 1
      drawHeader(reportTitle)

      pdf.setFont(REPORT_FONT_FAMILY, "bold")
      pdf.setFontSize(13)
      pdf.setTextColor(30, 41, 59)
      pdf.text(scope === "course" ? "Section-wise Statistical Summary" : "Detailed Section Statistics", margin, 106)

      pdf.setFont(REPORT_FONT_FAMILY, "normal")
      pdf.setFontSize(9.5)
      pdf.setTextColor(71, 85, 105)
      if (scope === "course") {
        pdf.text(
          "Each section is listed below with component-wise descriptive statistics.",
          margin,
          120
        )
      }

      let cursorY = scope === "course" ? 132 : 120
      rowsToRender.forEach((row, index) => {
        const estimatedHeight = 12 + 24 + 8 + 22 + 10 + 18 + REPORT_METRICS.length * 18 + 12 + 12
        if (index > 0 && cursorY + estimatedHeight > pageHeight - 42) {
          drawFooter()
          pdf.addPage()
          pageNumber += 1
          drawHeader(reportTitle)
          pdf.setFont(REPORT_FONT_FAMILY, "bold")
          pdf.setFontSize(13)
          pdf.setTextColor(30, 41, 59)
          pdf.text(scope === "course" ? "Section-wise Statistical Summary" : "Detailed Section Statistics", margin, 106)
          if (scope === "course") {
            pdf.setFont(REPORT_FONT_FAMILY, "normal")
            pdf.setFontSize(9.5)
            pdf.setTextColor(71, 85, 105)
            pdf.text(
              "Each section is listed below with component-wise descriptive statistics.",
              margin,
              120
            )
          }
          cursorY = scope === "course" ? 132 : 120
        }
        cursorY = drawSectionTable(cursorY, row) + 18
      })

      drawFooter()

      pdf.save(name)
      onClose()
    } finally {
      setIsGenerating(false)
    }
  }

  const canCourse = !!courseAggregate

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Generate PDF Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Scope selector */}
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Report scope</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Whole course */}
              <button
                disabled={!canCourse}
                onClick={() => setScope("course")}
                className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${scope === "course" && canCourse ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-200 dark:border-slate-700 hover:border-indigo-300"} ${!canCourse ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <BookOpen className="w-5 h-5 mb-2 text-indigo-600" />
                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">Entire Course</p>
                <p className="text-xs text-slate-500 mt-1">All {data.length} sections combined</p>
              </button>

              {/* Single section */}
              <button
                onClick={() => setScope("section")}
                className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${scope === "section" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-200 dark:border-slate-700 hover:border-indigo-300"} cursor-pointer`}
              >
                <FileText className="w-5 h-5 mb-2 text-indigo-600" />
                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">Single Section</p>
                <p className="text-xs text-slate-500 mt-1">One section at a time</p>
              </button>
            </div>
          </div>

          {/* Section dropdown if single */}
          {scope === "section" && (
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Select section</p>
              <div className="grid grid-cols-2 gap-2">
                {data.map(s => (
                  <button
                    key={s.sectionId}
                    onClick={() => setSelectedSectionId(s.sectionId)}
                    className={`p-3 rounded-lg border-2 text-left text-sm transition-all ${selectedSectionId === s.sectionId ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-semibold" : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300"}`}
                  >
                    <div className="font-medium">{s.sectionName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.facultyName} · {s.totalStudents} students</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview summary */}
          {rowsToRender.length > 0 && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-sm text-slate-600 dark:text-slate-400">
              Report will include <strong className="text-slate-900 dark:text-white">{rowsToRender.length} section{rowsToRender.length > 1 ? "s" : ""}</strong> and 
              {" "}<strong className="text-slate-900 dark:text-white">{rowsToRender.reduce((s, r) => s + r.totalStudents, 0)} students</strong> total.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || rowsToRender.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            {isGenerating ? "Generating…" : "Download PDF"}
          </Button>
        </DialogFooter>

        {/* Hidden off-screen visual summary captured by html-to-image */}
        <div
          style={{
            position: "fixed",
            top: -9999,
            left: -9999,
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          <ReportVisualSummary rows={rowsToRender} isCourse={scope === "course"} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ComponentMiniTable({ component }: {
  component: AssessmentComponentReport
}) {
  const classification = classifyAssessment({
    code: component.assessmentCode,
    name: component.assessmentName,
    category: component.assessmentCategory,
  })

  const headerColor =
    classification.family === "MID_TERM"
      ? "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
      : classification.family === "END_SEMESTER"
        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300"
        : classification.subcomponent === "QUIZ"
          ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300"
          : classification.subcomponent === "REVIEW"
            ? "bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-300"
            : classification.family === "CONTINUOUS_ASSESSMENT"
              ? "bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-300"
              : "bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-300"

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
      <CardHeader className={`py-3 px-4 border-b border-slate-200 dark:border-slate-800 ${headerColor}`}>
        <CardTitle className="text-sm font-bold">
          {component.assessmentName} [{component.maxMarks}]
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table className="table-fixed text-[11px]">
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="w-[68px] py-2">Section</TableHead>
              <TableHead className="w-[64px] py-2 text-right">Students</TableHead>
              <TableHead className="w-[58px] py-2 text-right">Mean</TableHead>
              <TableHead className="w-[58px] py-2 text-right">Median</TableHead>
              <TableHead className="w-[58px] py-2 text-right">Mode</TableHead>
              <TableHead className="w-[54px] py-2 text-right">SD</TableHead>
              <TableHead className="w-[54px] py-2 text-right">Min</TableHead>
              <TableHead className="w-[54px] py-2 text-right">Max</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {component.rows.map((row) => (
              <TableRow key={`${component.assessmentId}-${row.sectionId}`} className={row.sectionId === "ALL" ? "bg-slate-100 dark:bg-slate-800 font-bold" : ""}>
                <TableCell className="w-[68px] py-2 truncate">{row.sectionId === "ALL" ? "Course Avg" : row.sectionName}</TableCell>
                <TableCell className="w-[64px] py-2 text-right font-mono text-slate-500">{row.totalStudents}</TableCell>
                <TableCell className="w-[58px] py-2 text-right font-mono font-medium text-indigo-700 dark:text-indigo-400">{row.stats.avg.toFixed(1)}</TableCell>
                <TableCell className="w-[58px] py-2 text-right font-mono">{row.stats.median.toFixed(1)}</TableCell>
                <TableCell className="w-[58px] py-2 text-right font-mono text-slate-500">{row.stats.mode}</TableCell>
                <TableCell className="w-[54px] py-2 text-right font-mono text-slate-400">{row.stats.stdDev.toFixed(1)}</TableCell>
                <TableCell className="w-[54px] py-2 text-right font-mono text-rose-600">{row.stats.min.toFixed(1)}</TableCell>
                <TableCell className="w-[54px] py-2 text-right font-mono text-emerald-600">{row.stats.max.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function MetricSummaryTable({
  title,
  description,
  metricKey,
  rows,
}: {
  title: string
  description: string
  metricKey: "ca" | "caMidTerm" | "overall"
  rows: SectionReportData[]
}) {
  const outOf = rows[0]?.[metricKey].outOf ?? 0

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
      <CardHeader className="border-b border-slate-200 bg-slate-50 py-4 dark:border-slate-800 dark:bg-slate-900">
        <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200">
          {title} [{outOf}]
        </CardTitle>
        <p className="text-sm text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table className="text-sm whitespace-nowrap">
          <TableHeader>
            <TableRow className="bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-100">
              <TableHead>Section</TableHead>
              <TableHead className="text-center">Students</TableHead>
              <TableHead className="text-center">Mean</TableHead>
              <TableHead className="text-center">Median</TableHead>
              <TableHead className="text-center">Mode</TableHead>
              <TableHead className="text-center">SD</TableHead>
              <TableHead className="text-center">Min</TableHead>
              <TableHead className="text-center">Max</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const metric = row[metricKey]
              return (
                <TableRow key={`${metricKey}-${row.sectionId}`} className={row.sectionId === "ALL" ? "bg-slate-100 dark:bg-slate-800 font-bold" : ""}>
                  <TableCell>{row.sectionId === "ALL" ? "Course Avg" : row.sectionName}</TableCell>
                  <TableCell className="text-center font-mono text-slate-500">{row.totalStudents}</TableCell>
                  <TableCell className="text-center font-mono font-medium text-indigo-700 dark:text-indigo-400">{metric.avg.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-mono">{metric.median.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-mono text-slate-500">{metric.mode}</TableCell>
                  <TableCell className="text-center font-mono text-slate-400">{metric.stdDev.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-mono text-rose-600">{metric.min.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-mono text-emerald-600">{metric.max.toFixed(1)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

type StemLeafPoint = FinalMarkStemPoint & { leaf: string; displayScore: number }

function buildStemLeafRows(
  points: FinalMarkStemPoint[],
  unit: StemLeafUnit,
  sortMode: StemLeafSortMode,
  hideEmptyStems: boolean,
  outOf: number
) {
  const rows = new Map<number, StemLeafPoint[]>()

  points
    .map((point) => {
      const roundedScore = Math.round(point.score / unit) * unit
      const stem = Math.floor(roundedScore / 10)
      const remainder = roundedScore - stem * 10
      const leaf = unit === 1 ? Math.round(remainder).toString() : remainder.toFixed(1).replace(/\.0$/, "")

      return {
        ...point,
        leaf,
        displayScore: roundedScore,
      }
    })
    .sort((left, right) => {
      if (sortMode === "section") {
        return (
          left.sectionName.localeCompare(right.sectionName) ||
          left.displayScore - right.displayScore ||
          left.rollNo.localeCompare(right.rollNo)
        )
      }

      return left.displayScore - right.displayScore || left.rollNo.localeCompare(right.rollNo)
    })
    .forEach((point) => {
      const stem = Math.floor(point.displayScore / 10)
      if (!rows.has(stem)) rows.set(stem, [])
      rows.get(stem)!.push(point)
    })

  const stems = hideEmptyStems
    ? [...rows.keys()].sort((left, right) => left - right)
    : Array.from({ length: Math.floor(outOf / 10) + 1 }, (_, index) => index)

  return stems.map((stem) => ({
    stem,
    leaves: rows.get(stem) ?? [],
  }))
}

function getFinalScoreRangeKey(score: number, outOf: number): HighlightRangeKey {
  const percentage = outOf > 0 ? (score / outOf) * 100 : 0
  if (percentage >= 90) return "GE90"
  if (percentage >= 80) return "80_89"
  if (percentage >= 70) return "70_79"
  if (percentage >= 60) return "60_69"
  if (percentage >= 50) return "50_59"
  return "LT50"
}

function getFinalScoreRangeColor(score: number, outOf: number) {
  const range = getFinalScoreRangeKey(score, outOf)
  if (range === "GE90") return "var(--chart-1)"
  if (range === "80_89") return "var(--chart-3)"
  if (range === "70_79") return "var(--chart-6)"
  if (range === "60_69") return "var(--chart-4)"
  if (range === "50_59") return "var(--chart-7)"
  return "var(--destructive)"
}

function StemLeafExplorerFullScreen({
  open,
  onOpenChange,
  points,
  sectionEntries,
  colorBySection,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  points: FinalMarkStemPoint[]
  sectionEntries: Array<[string, string]>
  colorBySection: Map<string, string>
}) {
  const [unit, setUnit] = useState<StemLeafUnit>(1)
  const [selectedSectionId, setSelectedSectionId] = useState("ALL")
  const [sortMode, setSortMode] = useState<StemLeafSortMode>("score")
  const [showRollNumbers, setShowRollNumbers] = useState(false)
  const [highlightRange, setHighlightRange] = useState<HighlightRangeKey>("ALL")
  const [hideEmptyStems, setHideEmptyStems] = useState(true)
  const [sectionComparisonMode, setSectionComparisonMode] = useState(false)

  const visiblePoints = useMemo(
    () =>
      selectedSectionId === "ALL"
        ? points
        : points.filter((point) => point.sectionId === selectedSectionId),
    [points, selectedSectionId]
  )
  const outOf = points[0]?.outOf ?? 100
  const stemGroups = useMemo(() => {
    if (sectionComparisonMode) {
      const visibleSectionIds = new Set(visiblePoints.map((point) => point.sectionId))
      return sectionEntries
        .filter(([sectionId]) => visibleSectionIds.has(sectionId))
        .map(([sectionId, sectionName]) => ({
          id: sectionId,
          name: sectionName,
          rows: buildStemLeafRows(
            visiblePoints.filter((point) => point.sectionId === sectionId),
            unit,
            sortMode,
            hideEmptyStems,
            outOf
          ),
        }))
    }

    const selectedSectionName =
      selectedSectionId === "ALL"
        ? "All selected sections"
        : sectionEntries.find(([sectionId]) => sectionId === selectedSectionId)?.[1] ?? "Selected section"

    return [
      {
        id: selectedSectionId,
        name: selectedSectionName,
        rows: buildStemLeafRows(visiblePoints, unit, sortMode, hideEmptyStems, outOf),
      },
    ]
  }, [hideEmptyStems, outOf, sectionComparisonMode, sectionEntries, selectedSectionId, sortMode, unit, visiblePoints])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-background/95 px-5 py-4 backdrop-blur dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Final Marks</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Stem-and-Leaf Explorer
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              A full-screen view of final grand totals. Stems are tens, leaves are the remaining score digits.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close Explorer
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 p-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40 lg:sticky lg:top-28 lg:self-start">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Section</div>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => setSelectedSectionId("ALL")}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selectedSectionId === "ALL"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-slate-200 bg-card text-slate-700 hover:border-primary/40 dark:border-slate-800 dark:text-slate-300"
                }`}
              >
                All sections
              </button>
              {sectionEntries.map(([sectionId, sectionName]) => (
                <button
                  key={sectionId}
                  type="button"
                  onClick={() => setSelectedSectionId(sectionId)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                    selectedSectionId === sectionId
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-card text-slate-700 hover:border-primary/40 dark:border-slate-800 dark:text-slate-300"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: colorBySection.get(sectionId) ?? "var(--primary)" }}
                  />
                  {sectionName}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Leaf granularity</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { value: 1, label: "Whole" },
                { value: 0.5, label: "Half" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setUnit(option.value as StemLeafUnit)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    unit === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-card text-slate-700 hover:border-primary/40 dark:border-slate-800 dark:text-slate-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Whole rounds to nearest mark. Half preserves 0.5 steps.</p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sort within leaves</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { value: "score", label: "Score" },
                { value: "section", label: "Section" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSortMode(option.value as StemLeafSortMode)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    sortMode === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-card text-slate-700 hover:border-primary/40 dark:border-slate-800 dark:text-slate-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Highlight range</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {STEM_LEAF_HIGHLIGHT_RANGES.map((range) => (
                <button
                  key={range.key}
                  type="button"
                  onClick={() => setHighlightRange(range.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    highlightRange === range.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-card text-slate-700 hover:border-primary/40 dark:border-slate-800 dark:text-slate-300"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {[
              {
                label: "Show roll numbers",
                checked: showRollNumbers,
                onChange: () => setShowRollNumbers((current) => !current),
              },
              {
                label: "Hide empty stems",
                checked: hideEmptyStems,
                onChange: () => setHideEmptyStems((current) => !current),
              },
              {
                label: "Section comparison mode",
                checked: sectionComparisonMode,
                onChange: () => setSectionComparisonMode((current) => !current),
              },
            ].map((control) => (
              <label
                key={control.label}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-card px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300"
              >
                <span>{control.label}</span>
                <input
                  type="checkbox"
                  checked={control.checked}
                  onChange={control.onChange}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </label>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-card p-3 text-xs text-slate-500 dark:border-slate-800">
            Key: <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">7 | 4</span> means{" "}
            74 out of {outOf}.
          </div>
          <div className="rounded-xl border border-slate-200 bg-card p-3 text-xs text-slate-500 dark:border-slate-800">
            Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{visiblePoints.length}</span>{" "}
            students in this view.
          </div>
          <div className="rounded-xl border border-slate-200 bg-card p-3 text-xs text-slate-500 dark:border-slate-800">
            Shading is range-aware. Section context is still available through filters and hover details.
          </div>
        </aside>

        <main className="min-h-[calc(100vh-8rem)] rounded-2xl border border-slate-200 bg-card dark:border-slate-800">
          <div className="sticky top-[89px] z-10 grid grid-cols-[88px_minmax(0,1fr)] border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <div>Stem</div>
            <div>Leaves</div>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {stemGroups.length > 0 ? (
              stemGroups.map((group) => (
                <div key={group.id} className="divide-y divide-slate-200 dark:divide-slate-800">
                  {sectionComparisonMode ? (
                    <div className="bg-slate-50/70 px-5 py-3 text-sm font-semibold text-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
                      {group.name}
                    </div>
                  ) : null}
                  {group.rows.map((row) => (
                    <div key={`${group.id}-${row.stem}`} className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 px-5 py-4">
                      <div className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-100">{row.stem}</div>
                      <div className="flex flex-wrap gap-2.5">
                        {row.leaves.length > 0 ? (
                          row.leaves.map((point) => {
                            const rangeColor = getFinalScoreRangeColor(point.displayScore, point.outOf)
                            const pointRange = getFinalScoreRangeKey(point.displayScore, point.outOf)
                            const isDimmed = highlightRange !== "ALL" && pointRange !== highlightRange

                            return (
                              <span
                                key={`${point.studentId}-${point.displayScore}`}
                                title={`${point.rollNo} · ${point.studentName} · ${point.sectionName} · ${point.displayScore} / ${point.outOf}`}
                                className={`inline-flex min-w-10 items-center justify-center gap-1 rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold shadow-sm transition ${
                                  isDimmed ? "opacity-25 grayscale" : ""
                                }`}
                                style={{
                                  borderColor: rangeColor,
                                  color: rangeColor,
                                  background: `linear-gradient(135deg, color-mix(in srgb, ${rangeColor} 20%, var(--card)), color-mix(in srgb, ${rangeColor} 7%, var(--card)))`,
                                }}
                              >
                                <span>{point.leaf}</span>
                                {showRollNumbers ? (
                                  <span className="text-[10px] font-medium opacity-70">{point.rollNo}</span>
                                ) : null}
                              </span>
                            )
                          })
                        ) : (
                          <span className="text-sm text-slate-400">No leaves</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <div className="px-4 py-20 text-center text-sm text-slate-500">
                No final marks found for this filter.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function FinalMarksStemChart({
  points,
}: {
  points: FinalMarkStemPoint[]
}) {
  const [isExporting, setIsExporting] = useState(false)
  const [stemLeafOpen, setStemLeafOpen] = useState(false)
  const chart = useMemo(() => {
    const sortedPoints = [...points].sort((left, right) => left.score - right.score)
    const sectionEntries = [...new Map(points.map((point) => [point.sectionId, point.sectionName])).entries()]
    const colorBySection = new Map(
      sectionEntries.map(([sectionId], index) => [sectionId, getSectionColor(index)])
    )
    const outOf = sortedPoints[0]?.outOf || 100
    const leftPadding = 52
    const rightPadding = 24
    const topPadding = 20
    const bottomPadding = 42
    const stemSpacing = sortedPoints.length > 72 ? 12 : sortedPoints.length > 44 ? 16 : 22
    const width = Math.max(720, leftPadding + rightPadding + Math.max(sortedPoints.length - 1, 1) * stemSpacing)
    const height = 320
    const plotHeight = height - topPadding - bottomPadding
    const baselineY = topPadding + plotHeight

    const chartPoints = sortedPoints.map((point, index) => {
      const x = leftPadding + index * stemSpacing
      const y = topPadding + (1 - Math.min(point.score, outOf) / outOf) * plotHeight
      return {
        ...point,
        x,
        y,
        color: colorBySection.get(point.sectionId) ?? "var(--primary)",
      }
    })

    return {
      chartPoints,
      sectionEntries,
      colorBySection,
      outOf,
      width,
      height,
      leftPadding,
      rightPadding,
      topPadding,
      bottomPadding,
      plotHeight,
      baselineY,
    }
  }, [points])

  if (points.length === 0) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-sm">Final Marks Stem Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800">
            Final marks will appear here once component marks are available.
          </div>
        </CardContent>
      </Card>
    )
  }

  const ticks = [0, 25, 50, 75, 100].map((percentage) => Number(((chart.outOf * percentage) / 100).toFixed(1)))
  const meanScore = average(points.map((point) => point.score))
  const meanY = chart.topPadding + (1 - Math.min(meanScore, chart.outOf) / chart.outOf) * chart.plotHeight
  const handleExportPng = async () => {
    setIsExporting(true)
    try {
      const { imgData } = await captureElementAsImage(FINAL_MARKS_STEM_EXPORT_ID, {
        pixelRatio: 3,
        forcePaletteTheme: "aurora",
      })
      const link = document.createElement("a")
      link.href = imgData
      link.download = `final-marks-stem-chart-${new Date().toISOString().slice(0, 10)}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success("Stem chart exported as PNG")
    } catch (error) {
      console.error("Stem chart export failed:", error)
      toast.error("Unable to export stem chart")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-sm">Final Marks Stem Chart</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Grand total across all assessment components. Each stem is one student, sorted by final score.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setStemLeafOpen(true)}>
            Explore Stem-and-Leaf
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleExportPng} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export PNG"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div id={FINAL_MARKS_STEM_EXPORT_ID} className="space-y-4 rounded-2xl bg-card p-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <svg
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              width={chart.width}
              height={chart.height}
              role="img"
              aria-label="Stem chart showing student final marks"
              className="max-w-none"
            >
              <line
                x1={chart.leftPadding}
                x2={chart.width - chart.rightPadding}
                y1={chart.baselineY}
                y2={chart.baselineY}
                stroke={CHART_THEME.grid}
                strokeWidth="1.5"
              />
              {ticks.map((tick) => {
                const y = chart.topPadding + (1 - tick / chart.outOf) * chart.plotHeight
                return (
                  <g key={tick}>
                    <line
                      x1={chart.leftPadding}
                      x2={chart.width - chart.rightPadding}
                      y1={y}
                      y2={y}
                      stroke={CHART_THEME.grid}
                      strokeDasharray="4 5"
                      opacity="0.45"
                    />
                    <text x={chart.leftPadding - 10} y={y + 4} textAnchor="end" fontSize="11" fill={CHART_THEME.axis}>
                      {tick}
                    </text>
                  </g>
                )
              })}
              <line
                x1={chart.leftPadding}
                x2={chart.width - chart.rightPadding}
                y1={meanY}
                y2={meanY}
                stroke="var(--primary)"
                strokeDasharray="6 6"
                strokeWidth="1.5"
                opacity="0.72"
              />
              <text
                x={chart.width - chart.rightPadding}
                y={meanY - 6}
                textAnchor="end"
                fontSize="11"
                fill="var(--primary)"
                fontWeight="600"
              >
                Mean {meanScore.toFixed(1)}
              </text>
              {chart.chartPoints.map((point) => (
                <g key={`${point.studentId}-${point.sectionId}`}>
                  <line
                    x1={point.x}
                    x2={point.x}
                    y1={chart.baselineY}
                    y2={point.y}
                    stroke={point.color}
                    strokeWidth="1.5"
                    opacity="0.44"
                  />
                  <circle cx={point.x} cy={point.y} r="4.2" fill={point.color} stroke="var(--card)" strokeWidth="1.4">
                    <title>
                      {`${point.rollNo} · ${point.studentName}\n${point.sectionName}\nFinal: ${point.score.toFixed(1)} / ${point.outOf}`}
                    </title>
                  </circle>
                </g>
              ))}
              <text
                x={chart.leftPadding}
                y={chart.height - 10}
                fontSize="11"
                fill={CHART_THEME.axis}
              >
                Lower final totals
              </text>
              <text
                x={chart.width - chart.rightPadding}
                y={chart.height - 10}
                textAnchor="end"
                fontSize="11"
                fill={CHART_THEME.axis}
              >
                Higher final totals
              </text>
            </svg>
          </div>
          <div className="flex flex-wrap gap-2">
            {chart.sectionEntries.map(([sectionId, sectionName]) => (
              <span
                key={sectionId}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: chart.colorBySection.get(sectionId) ?? "var(--primary)" }}
                />
                {sectionName}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
      <StemLeafExplorerFullScreen
        open={stemLeafOpen}
        onOpenChange={setStemLeafOpen}
        points={points}
        sectionEntries={chart.sectionEntries}
        colorBySection={chart.colorBySection}
      />
    </Card>
  )
}

// ─── Main client component ─────────────────────────────────────────────────

type ReportDetailData = {
  componentReports: AssessmentComponentReport[]
  finalMarkStemData: FinalMarkStemPoint[]
}

export function ReportsClient({ data, courseAggregate, reportMeta, loadDetailsAction }: {
  data: SectionReportData[]
  courseAggregate: SectionReportData | null
  reportMeta: ReportMeta
  loadDetailsAction: () => Promise<ReportDetailData>
}) {
  const [configOpen, setConfigOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "details">("overview")
  const [detailData, setDetailData] = useState<ReportDetailData | null>(null)
  const [isLoadingDetails, startLoadingDetails] = useTransition()

  const allRows = courseAggregate ? [...data, courseAggregate] : data

  const chartData = data.map(r => ({
    name: r.sectionName,
    quizAvg: r.quiz.avg,
    reviewAvg: r.review.avg,
    caAvg: r.ca.avg,
    midTermAvg: r.midTerm.avg,
    caMidTermAvg: r.caMidTerm.avg,
    endSemesterAvg: r.endSemester.avg,
    overallAvg: r.overall.avg,
  }))

  const detailComponentReports = Array.isArray(detailData?.componentReports)
    ? detailData.componentReports
    : []
  const detailStemPoints = Array.isArray(detailData?.finalMarkStemData)
    ? detailData.finalMarkStemData
    : []
  const hasDetailData = detailComponentReports.length > 0 || detailStemPoints.length > 0

  const ensureDetailsLoaded = () => {
    if (detailData || isLoadingDetails) return

    startLoadingDetails(async () => {
      try {
        const nextDetailData = await loadDetailsAction()
        setDetailData({
          componentReports: Array.isArray(nextDetailData?.componentReports) ? nextDetailData.componentReports : [],
          finalMarkStemData: Array.isArray(nextDetailData?.finalMarkStemData) ? nextDetailData.finalMarkStemData : [],
        })
      } catch (error) {
        console.error(error)
        toast.error("Failed to load detailed report tables")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-end">
        <Button
          onClick={() => setConfigOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
        >
          <Download className="w-4 h-4 mr-2" />
          Export PDF Report
        </Button>
      </div>

      {/* Report config dialog */}
      <ReportConfigDialog
        data={data}
        courseAggregate={courseAggregate}
        reportMeta={reportMeta}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const nextTab = value as "overview" | "details"
          setActiveTab(nextTab)
          if (nextTab === "details") {
            ensureDetailsLoaded()
          }
        }}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Detailed Tables</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4">
              <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200">Master Consolidated View</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="text-xs whitespace-nowrap">
                <TableHeader>
                  <TableRow className="bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-100">
                    <TableHead rowSpan={2} className="border-r border-slate-200 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 sticky left-0 z-20">Section</TableHead>
                    <TableHead rowSpan={2} className="border-r border-slate-200 dark:border-slate-700 text-center">Students</TableHead>
                    {REPORT_METRICS.map((metric, index) => (
                      <TableHead
                        key={metric.key}
                        colSpan={6}
                        className={`text-center font-bold ${
                          index < REPORT_METRICS.length - 1 ? "border-r border-slate-200 dark:border-slate-700" : ""
                        }`}
                      >
                        {metric.label} [{allRows[0]?.[metric.key].outOf ?? 0}]
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-900/20 hover:bg-slate-50/50">
                    {REPORT_METRICS.flatMap((metric, i) => [
                      <TableHead key={`${metric.key}-mean`} className={`text-center ${i === 0 ? "border-l border-slate-200 dark:border-slate-700" : ""}`}>Mean</TableHead>,
                      <TableHead key={`${metric.key}-med`} className="text-center">Median</TableHead>,
                      <TableHead key={`${metric.key}-mode`} className="text-center">Mode</TableHead>,
                      <TableHead key={`${metric.key}-sd`} className="text-center">SD</TableHead>,
                      <TableHead key={`${metric.key}-min`} className="text-center">Min</TableHead>,
                      <TableHead key={`${metric.key}-max`} className={`text-center ${i < REPORT_METRICS.length - 1 ? "border-r border-slate-200 dark:border-slate-700" : ""}`}>Max</TableHead>,
                    ])}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allRows.map(row => (
                    <TableRow key={row.sectionId} className={row.sectionId === "ALL" ? "bg-slate-100 dark:bg-slate-800 font-bold" : ""}>
                      <TableCell className={`border-r border-slate-200 dark:border-slate-700 sticky left-0 z-20 ${row.sectionId === "ALL" ? "bg-slate-100 dark:bg-slate-800" : "bg-white dark:bg-slate-900"}`}>{row.sectionId === "ALL" ? "Course Avg" : row.sectionName}</TableCell>
                      <TableCell className="border-r border-slate-200 dark:border-slate-700 text-center font-mono">{row.totalStudents}</TableCell>
                      {REPORT_METRICS.map((metric, ki) => (
                        <React.Fragment key={`${row.sectionId}-${metric.key}`}>
                          <TableCell className={`text-center font-mono font-medium text-indigo-700 dark:text-indigo-400 ${ki === 0 ? "border-l border-slate-200 dark:border-slate-700" : ""}`}>{row[metric.key].avg.toFixed(1)}</TableCell>
                          <TableCell className="text-center font-mono">{row[metric.key].median.toFixed(1)}</TableCell>
                          <TableCell className="text-center font-mono text-slate-500">{row[metric.key].mode}</TableCell>
                          <TableCell className="text-center font-mono text-slate-400">{row[metric.key].stdDev.toFixed(1)}</TableCell>
                          <TableCell className="text-center font-mono text-rose-600">{row[metric.key].min.toFixed(1)}</TableCell>
                          <TableCell className={`text-center font-mono text-emerald-600 ${ki < REPORT_METRICS.length - 1 ? "border-r border-slate-200 dark:border-slate-700" : ""}`}>{row[metric.key].max.toFixed(1)}</TableCell>
                        </React.Fragment>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Combined Performance Tables</h2>
              <p className="text-sm text-slate-500">
                Focused section-wise summaries for all CA components together, CA plus Mid Term, and the total weighted performance.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <MetricSummaryTable
                title="Combined Performance in All CAs"
                description="Aggregated descriptive statistics for the full Continuous Assessment bucket."
                metricKey="ca"
                rows={allRows}
              />
              <MetricSummaryTable
                title="Combined Performance in CA + Mid Term"
                description="Aggregated descriptive statistics after combining all CAs with the Mid Term component."
                metricKey="caMidTerm"
                rows={allRows}
              />
              <MetricSummaryTable
                title="Total Performance"
                description="Aggregated descriptive statistics for the full weighted total across all active components."
                metricKey="overall"
                rows={allRows}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
              <CardHeader><CardTitle className="text-sm">Section-wise Overall Mean</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} opacity={0.45} />
                      <XAxis dataKey="name" tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: CHART_THEME.tooltipBackground,
                          borderColor: CHART_THEME.tooltipBorder,
                          color: CHART_THEME.tooltipForeground,
                          borderRadius: "8px",
                        }}
                        cursor={{ fill: CHART_THEME.cursor, opacity: 0.18 }}
                      />
                      <Bar dataKey="overallAvg" name="Overall Mean" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
              <CardHeader><CardTitle className="text-sm">Quiz vs Review vs CA + Mid Term</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} opacity={0.45} />
                      <XAxis dataKey="name" tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: CHART_THEME.tooltipBackground,
                          borderColor: CHART_THEME.tooltipBorder,
                          color: CHART_THEME.tooltipForeground,
                          borderRadius: "8px",
                        }}
                        cursor={{ fill: CHART_THEME.cursor, opacity: 0.18 }}
                      />
                      <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
                      <Bar dataKey="quizAvg" name="Quiz Avg" fill={METRIC_COLOR_MAP.quiz} />
                      <Bar dataKey="reviewAvg" name="Review Avg" fill={METRIC_COLOR_MAP.review} />
                      <Bar dataKey="caAvg" name="CA Avg" fill={METRIC_COLOR_MAP.ca} />
                      <Bar dataKey="midTermAvg" name="Mid Term Avg" fill={METRIC_COLOR_MAP.midTerm} />
                      <Bar dataKey="caMidTermAvg" name="CA + Mid Avg" fill={METRIC_COLOR_MAP.caMidTerm} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          {hasDetailData ? (
            <>
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Component-wise Statistical Summary</h2>
                  <p className="text-sm text-slate-500">
                    Each assessment component is listed separately below so individual quizzes, reviews, and other components stay visible on their own.
                  </p>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                  {detailComponentReports.map((component) => (
                    <ComponentMiniTable key={component.assessmentId} component={component} />
                  ))}
                </div>
              </div>

              <FinalMarksStemChart points={detailStemPoints} />
            </>
          ) : (
            <Card className="border-dashed border-slate-300 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/60">
              <CardHeader>
                <CardTitle className="text-base">Detailed tables load on demand</CardTitle>
                <p className="text-sm text-slate-500">
                  Open this tab when you want per-component statistics and the final-marks stem chart. Keeping it separate makes the reports page feel much faster on first load.
                </p>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={ensureDetailsLoaded}
                  disabled={isLoadingDetails}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isLoadingDetails ? "Loading detailed tables..." : "Load Detailed Tables"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
