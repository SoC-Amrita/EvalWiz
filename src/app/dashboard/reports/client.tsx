"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { REPORT_METRICS, type ReportMetricKey } from "@/lib/assessment-structure"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { ReportMeta, SectionReportData } from "./page"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Download, FileText, BookOpen } from "lucide-react"
import { captureElementAsImage } from "@/lib/pdf-export"
import React, { useState } from "react"
import jsPDF from "jspdf"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from "recharts"

const REPORT_VISUAL_EXPORT_ID = "report-visual-export"
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
        name: row.sectionName.replace("Section ", ""),
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
        forceLightTheme: true,
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
        const sectionLabel = row.sectionName.startsWith("Section ")
          ? row.sectionName
          : `Section ${row.sectionName}`

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

// ─── Mini stat table for dashboard ────────────────────────────────────────

function MiniTable({ title, data, metricKey, headerColor }: {
  title: string
  data: SectionReportData[]
  metricKey: ReportMetricKey
  headerColor: string
}) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
      <CardHeader className={`py-3 px-4 ${headerColor}`}>
        <CardTitle className="text-sm font-bold truncate">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="py-2">Section</TableHead>
              <TableHead className="py-2 text-right">Stdts</TableHead>
              <TableHead className="py-2 text-right">Mean</TableHead>
              <TableHead className="py-2 text-right">Median</TableHead>
              <TableHead className="py-2 text-right">Mode</TableHead>
              <TableHead className="py-2 text-right">SD</TableHead>
              <TableHead className="py-2 text-right">Min</TableHead>
              <TableHead className="py-2 text-right">Max</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(row => (
              <TableRow key={row.sectionId} className={row.sectionId === "ALL" ? "bg-slate-100 dark:bg-slate-800 font-bold" : ""}>
                <TableCell className="py-2">{row.sectionId === "ALL" ? "Course Avg" : row.sectionName.replace("Section ", "")}</TableCell>
                <TableCell className="py-2 text-right font-mono text-slate-500">{row.totalStudents}</TableCell>
                <TableCell className="py-2 text-right font-mono text-indigo-700 dark:text-indigo-400 font-medium">{row[metricKey].avg.toFixed(1)}</TableCell>
                <TableCell className="py-2 text-right font-mono">{row[metricKey].median.toFixed(1)}</TableCell>
                <TableCell className="py-2 text-right font-mono text-slate-500">{row[metricKey].mode}</TableCell>
                <TableCell className="py-2 text-right font-mono text-slate-400">{row[metricKey].stdDev.toFixed(1)}</TableCell>
                <TableCell className="py-2 text-right font-mono text-rose-600">{row[metricKey].min.toFixed(1)}</TableCell>
                <TableCell className="py-2 text-right font-mono text-emerald-600">{row[metricKey].max.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ─── Main client component ─────────────────────────────────────────────────

export function ReportsClient({ data, courseAggregate, reportMeta }: {
  data: SectionReportData[]
  courseAggregate: SectionReportData | null
  reportMeta: ReportMeta
}) {
  const [configOpen, setConfigOpen] = useState(false)

  const allRows = courseAggregate ? [...data, courseAggregate] : data

  const chartData = data.map(r => ({
    name: r.sectionName.replace("Section ", ""),
    quizAvg: r.quiz.avg,
    reviewAvg: r.review.avg,
    caAvg: r.ca.avg,
    midTermAvg: r.midTerm.avg,
    caMidTermAvg: r.caMidTerm.avg,
    endSemesterAvg: r.endSemester.avg,
    overallAvg: r.overall.avg,
  }))

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

      {/* ── Master consolidated table ── */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4">
          <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200">Master Consolidated View</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="text-xs whitespace-nowrap">
            <TableHeader>
              <TableRow className="bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-100">
                <TableHead rowSpan={2} className="border-r border-slate-200 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 sticky left-0 z-20">Section</TableHead>
                <TableHead rowSpan={2} className="border-r border-slate-200 dark:border-slate-700 text-center">Stdts</TableHead>
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
                  <TableCell className={`border-r border-slate-200 dark:border-slate-700 sticky left-0 z-20 ${row.sectionId === "ALL" ? "bg-slate-100 dark:bg-slate-800" : "bg-white dark:bg-slate-900"}`}>{row.sectionName}</TableCell>
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

      {/* ── Component mini tables ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <MiniTable title={`Quiz [${allRows[0]?.quiz.outOf ?? 0}]`} data={allRows} metricKey="quiz" headerColor="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300" />
        <MiniTable title={`Review [${allRows[0]?.review.outOf ?? 0}]`} data={allRows} metricKey="review" headerColor="bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-300" />
        <MiniTable title={`Continuous Assessment [${allRows[0]?.ca.outOf ?? 0}]`} data={allRows} metricKey="ca" headerColor="bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-300" />
        <MiniTable title={`CA + Mid Term [${allRows[0]?.caMidTerm.outOf ?? 0}]`} data={allRows} metricKey="caMidTerm" headerColor="bg-teal-50 dark:bg-teal-900/20 text-teal-800 dark:text-teal-300" />
        <MiniTable title={`Mid Term [${allRows[0]?.midTerm.outOf ?? 0}]`} data={allRows} metricKey="midTerm" headerColor="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300" />
        <MiniTable title={`End Semester [${allRows[0]?.endSemester.outOf ?? 0}]`} data={allRows} metricKey="endSemester" headerColor="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300" />
        <MiniTable title={`Overall [${allRows[0]?.overall.outOf ?? 0}]`} data={allRows} metricKey="overall" headerColor="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-300" />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <CardHeader><CardTitle className="text-sm">Section-wise Overall Mean</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <RechartsTooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", color: "#f8fafc", borderRadius: "8px" }} cursor={{ fill: "#334155", opacity: 0.1 }} />
                  <Bar dataKey="overallAvg" name="Overall Mean" fill="#6366f1" radius={[4, 4, 0, 0]} />
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", color: "#f8fafc", borderRadius: "8px" }} cursor={{ fill: "#334155", opacity: 0.1 }} />
                  <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
                  <Bar dataKey="quizAvg" name="Quiz Avg" fill="#6366f1" />
                  <Bar dataKey="reviewAvg" name="Review Avg" fill="#8b5cf6" />
                  <Bar dataKey="caAvg" name="CA Avg" fill="#38bdf8" />
                  <Bar dataKey="midTermAvg" name="Mid Term Avg" fill="#fbbf24" />
                  <Bar dataKey="caMidTermAvg" name="CA + Mid Avg" fill="#14b8a6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
