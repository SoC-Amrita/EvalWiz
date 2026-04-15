"use client"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

import { getDerivedGradeBands, resolveGradeBand, type GradeRule } from "@/lib/grade-rules"
import type { AdvancedAnalyticsExportMeta } from "@/app/dashboard/advanced-analytics/types"
import type { GradingReportSection } from "@/app/dashboard/reports/types"

type ExamType = "Regular" | "Supplementary" | "Redo"

type GradingReportWeights = {
  ca: number
  midTerm: number
  endSemester: number
  overall: number
}

type DownloadClassReportOptions = {
  exportMeta: AdvancedAnalyticsExportMeta
  section: GradingReportSection
  rule: GradeRule
  weights: GradingReportWeights
  examDate: string
  examType: ExamType
  facultyName: string
}

const AURORA = {
  primary: [79, 70, 229] as [number, number, number],
  secondary: [159, 18, 57] as [number, number, number],
  accent: [255, 247, 237] as [number, number, number],
  slate: [51, 65, 85] as [number, number, number],
  text: [17, 24, 39] as [number, number, number],
  muted: [71, 85, 105] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  soft: [248, 250, 252] as [number, number, number],
  softAlt: [255, 247, 237] as [number, number, number],
}

const TABLE_BORDER = [0, 0, 0] as [number, number, number]

function formatSlashDate(value: Date) {
  const day = String(value.getDate()).padStart(2, "0")
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const year = value.getFullYear()
  return `${day}/${month}/${year}`
}

function formatLongDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value)
}

function formatMark(value: number) {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")
}

function parseAcademicYearStart(academicYear: string) {
  const match = academicYear.match(/(20\d{2})/)
  return match ? Number(match[1]) : null
}

function parseProgramYear(value: string) {
  const numeric = value.match(/\d+/)
  if (numeric) return Number(numeric[0])

  const upper = value.toUpperCase()
  if (upper.includes("III")) return 3
  if (upper.includes("II")) return 2
  if (upper.includes("IV")) return 4
  if (upper.includes("I")) return 1

  return null
}

function inferBatchRange(exportMeta: AdvancedAnalyticsExportMeta) {
  const academicYearStart = parseAcademicYearStart(exportMeta.academicYear)
  const programYear = parseProgramYear(exportMeta.year)

  if (!academicYearStart || !programYear) return exportMeta.academicYear

  const start = academicYearStart - (programYear - 1)
  const end = start + 3
  return `${start} - ${end}`
}

function getBranchName(department: string) {
  return department.replace(/^Department of /i, "")
}

function getProgrammeLabel(exportMeta: AdvancedAnalyticsExportMeta) {
  const program = exportMeta.program.replace(/\s+/g, " ").trim()
  if (/^b\.?\s*tech$/i.test(program) && /computer science/i.test(exportMeta.department)) {
    return "BTech CSE"
  }

  return program.replace(/\./g, "")
}

function getAcademicProgrammeLabel(exportMeta: AdvancedAnalyticsExportMeta) {
  const program = exportMeta.program.replace(/\s+/g, " ").trim()
  if (/^b\.?\s*tech$/i.test(program) && /computer science/i.test(exportMeta.department)) {
    return "B.Tech CSE"
  }

  return program
}

function getSectionSuffix(classLabel: string) {
  const tokens = classLabel.trim().split(/\s+/)
  const last = tokens[tokens.length - 1] ?? classLabel
  return /^[A-Z]$/i.test(last) ? last.toUpperCase() : classLabel
}

function buildUpperBound(rule: GradeRule, index: number) {
  if (index === 0) return "100"

  const rawUpper = rule.bands[index - 1].minScore
  const hasWholeNumberBounds = Number.isInteger(rawUpper) && Number.isInteger(rule.bands[index].minScore)
  const displayUpper = hasWholeNumberBounds ? rawUpper - 1 : rawUpper - 0.01
  return formatMark(displayUpper)
}

function buildDistributionRows(section: GradingReportSection, rule: GradeRule) {
  const totalStudents = section.students.length
  const counts = new Map(rule.bands.map((band) => [band.id, 0]))

  section.students.forEach((student) => {
    const band = resolveGradeBand(rule, student.percentage)
    counts.set(band.id, (counts.get(band.id) ?? 0) + 1)
  })

  return getDerivedGradeBands(rule).map((band, index) => {
    const count = counts.get(band.id) ?? 0
    return [
      String(index + 1),
      band.label,
      formatMark(band.minScore),
      buildUpperBound(rule, index),
      String(count),
      totalStudents > 0 ? `${((count / totalStudents) * 100).toFixed(1)}%` : "0%",
    ]
  })
}

function drawReportHeader(pdf: jsPDF, options: {
  title: string
  school: string
  department?: string
  institution: string
}) {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 32

  pdf.setFillColor(...AURORA.accent)
  pdf.rect(0, 0, pageWidth, 92, "F")
  pdf.setDrawColor(...AURORA.primary)
  pdf.setLineWidth(2)
  pdf.line(margin, 88, pageWidth - margin, 88)

  pdf.setFont("times", "bold")
  pdf.setFontSize(9)
  pdf.setTextColor(99, 102, 241)
  pdf.text("EVALVIZ", margin, 24)

  pdf.setFontSize(13)
  pdf.setTextColor(...AURORA.secondary)
  pdf.text(options.title.toUpperCase(), pageWidth - margin, 24, { align: "right" })

  pdf.setFontSize(13)
  pdf.setTextColor(...AURORA.text)
  pdf.text(options.school, margin, 48)

  if (options.department) {
    pdf.setFontSize(11)
    pdf.text(options.department, margin, 62)
    pdf.setFontSize(15)
    pdf.text(options.institution, margin, 78)
  } else {
    pdf.setFontSize(15)
    pdf.text(options.institution, margin, 70)
  }
}

function drawInlineMeta(
  pdf: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) {
  const labelText = `${label}: `
  pdf.setFont("times", "bold")
  pdf.setFontSize(10.5)
  pdf.setTextColor(...AURORA.slate)
  pdf.text(labelText, x, y)

  const labelWidth = pdf.getTextWidth(labelText)
  pdf.setFont("times", "normal")
  pdf.setTextColor(...AURORA.text)
  const lines = pdf.splitTextToSize(value, Math.max(width - labelWidth - 6, 48))
  pdf.text(lines, x + labelWidth, y)
  return Math.max(1, lines.length)
}

function drawPageOne(options: DownloadClassReportOptions, pdf: jsPDF) {
  const { exportMeta, section, rule, weights, examDate, examType, facultyName } = options
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 32
  const contentWidth = pageWidth - margin * 2
  const now = new Date()
  const examDateLabel = examDate ? formatSlashDate(new Date(examDate)) : "________________"
  const totalStudents = section.students.length
  const appearedCount =
    weights.endSemester > 0
      ? section.students.filter((student) => student.hasEndSemesterScore).length
      : totalStudents
  const absentCount = totalStudents - appearedCount
  const classAverage =
    totalStudents > 0
      ? section.students.reduce((sum, student) => sum + student.total, 0) / totalStudents
      : 0
  const batchRange = inferBatchRange(exportMeta)
  const programLabel = getProgrammeLabel(exportMeta)
  const sectionSuffix = getSectionSuffix(section.classLabel)
  const appearedLabel = examType === "Regular" ? "End Semester Examination" : `${examType} Examination`
  const detailColumns = 2
  const detailGap = 18
  const detailColumnWidth = (contentWidth - detailGap) / detailColumns
  const distributionRows = buildDistributionRows(section, rule)

  drawReportHeader(pdf, {
    title: "Class Grading Report",
    school: "Amrita School of Computing, Coimbatore",
    institution: "Amrita Vishwa Vidyapeetham",
  })

  pdf.setFillColor(...AURORA.soft)
  pdf.roundedRect(margin, 108, contentWidth, 158, 10, 10, "F")

  const detailRows: Array<[string, string]> = [
    ["Date", formatSlashDate(now)],
    ["Department", "Computer Science & Engineering"],
    ["Programme", programLabel],
    ["Semester", `${exportMeta.semester} ${sectionSuffix}`],
    ["Batch", batchRange],
    ["Course Name", `${exportMeta.subjectCode} ${exportMeta.subjectTitle}`],
    ["Name of the Faculty", facultyName || "________________"],
    ["Date of Examination", examDateLabel],
    ["Exam Type", examType],
    ["Class Average", `${formatMark(classAverage)} / ${formatMark(weights.overall)}`],
    ["Enrollment Status", "All"],
    ["Students registered for the course", String(totalStudents)],
    [`Students appeared for the ${appearedLabel}`, String(appearedCount)],
    [`Students absent for the ${appearedLabel}`, String(absentCount)],
  ]

  let detailCursorY = 128
  for (let index = 0; index < detailRows.length; index += detailColumns) {
    const rowItems = detailRows.slice(index, index + detailColumns)
    const rowHeights = rowItems.map(([label, value], columnIndex) =>
      drawInlineMeta(
        pdf,
        label,
        value,
        margin + columnIndex * (detailColumnWidth + detailGap) + 14,
        detailCursorY,
        detailColumnWidth - 28
      )
    )
    detailCursorY += Math.max(...rowHeights) * 12 + 8
  }

  pdf.setFont("times", "bold")
  pdf.setFontSize(12)
  pdf.setTextColor(...AURORA.secondary)
  pdf.text("Grade Distribution", margin, 286)

  autoTable(pdf, {
    startY: 294,
    head: [
      [
        { content: "Sl No.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Grade", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Mark Range", colSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "No. of Students", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "% of Students", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      ],
      ["Lower Bound", "Upper Bound"],
    ],
    body: [
      ...distributionRows,
      [
        { content: "Total no. of students registered", colSpan: 4, styles: { halign: "left", fontStyle: "bold" } },
        String(totalStudents),
        totalStudents > 0 ? "100%" : "0%",
      ],
    ],
    styles: {
      font: "times",
      fontSize: 9,
      cellPadding: 4,
      textColor: AURORA.text,
      lineColor: TABLE_BORDER,
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: [...AURORA.slate],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: [...AURORA.soft],
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 48 },
      1: { halign: "center", cellWidth: 68 },
      2: { halign: "center", cellWidth: 82 },
      3: { halign: "center", cellWidth: 82 },
      4: { halign: "center", cellWidth: 92 },
      5: { halign: "center", cellWidth: 92 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.row.index === distributionRows.length) {
        hookData.cell.styles.fillColor = [...AURORA.softAlt]
        hookData.cell.styles.fontStyle = "bold"
      }
    },
    tableWidth: contentWidth,
    margin: { left: margin, right: margin },
  })

  const afterDistributionY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 420

  pdf.setFont("times", "bold")
  pdf.setFontSize(12)
  pdf.setTextColor(...AURORA.secondary)
  pdf.text("Class Committee Members", margin, afterDistributionY + 18)

  autoTable(pdf, {
    startY: afterDistributionY + 24,
    head: [["Name", "Signature"]],
    body: Array.from({ length: 4 }, () => ["", ""]),
    styles: {
      font: "times",
      fontSize: 9,
      cellPadding: 7,
      textColor: AURORA.text,
      lineColor: TABLE_BORDER,
      lineWidth: 0.25,
      minCellHeight: 22,
    },
    headStyles: {
      fillColor: [...AURORA.slate],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    tableWidth: contentWidth,
    margin: { left: margin, right: margin },
  })

  const afterCommitteeY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? afterDistributionY + 130

  pdf.setFont("times", "normal")
  pdf.setFontSize(10)
  pdf.setTextColor(...AURORA.text)
  pdf.text("Remarks of the Class Committee Convener:", margin, afterCommitteeY + 24)
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.4)
  pdf.line(margin, afterCommitteeY + 52, pageWidth - margin, afterCommitteeY + 52)
  pdf.setFont("times", "bold")
  pdf.text("Approved by:", margin, pageHeight - 96)
  pdf.text("Class Committee Convener", margin, pageHeight - 42)
  pdf.text("Chairperson", pageWidth / 2, pageHeight - 42, { align: "center" })
  pdf.text("Dean", pageWidth - margin, pageHeight - 42, { align: "right" })
}

function drawPageTwo(options: DownloadClassReportOptions, pdf: jsPDF) {
  const { exportMeta, section, rule, weights } = options
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 22
  const batchRange = inferBatchRange(exportMeta)
  const batchStart = batchRange.split(" - ")[0] ?? exportMeta.academicYear
  const branchName = getBranchName(exportMeta.department)
  const programmeLabel = getAcademicProgrammeLabel(exportMeta)

  pdf.addPage()
  drawReportHeader(pdf, {
    title: "Class Grading Report",
    school: "School of Computing",
    department: "Department of Computer Science & Engineering",
    institution: "Amrita Vishwa Vidyapeetham",
  })

  pdf.setFontSize(10)
  pdf.setTextColor(...AURORA.slate)
  pdf.text(`Academic Programme: ${programmeLabel} ${batchStart}.`, margin, 112)
  pdf.text(`Branch: ${branchName}`, pageWidth - margin, 112, { align: "right" })

  pdf.text(`Course Code: ${exportMeta.subjectCode}`, margin, 130)
  pdf.text(`Course: ${exportMeta.subjectTitle}`, pageWidth / 2, 130, { align: "center" })
  pdf.text(`Semester: ${exportMeta.semester}`, pageWidth - margin, 130, { align: "right" })

  autoTable(pdf, {
    startY: 146,
    head: [[
      "Sl No.",
      "Roll No.",
      "Name",
      `CA Total\n(${formatMark(weights.ca)} Marks)`,
      `Mid Terms\n(${formatMark(weights.midTerm)} Marks)`,
      `End Semester\n(${formatMark(weights.endSemester)} Marks)`,
      `Total\n(${formatMark(weights.overall)} Marks)`,
      "Grade",
    ]],
    body: section.students.map((student, index) => [
      String(index + 1),
      student.rollNo,
      student.studentName,
      formatMark(student.caTotal),
      formatMark(student.midTerm),
      student.hasEndSemesterScore || weights.endSemester <= 0 ? formatMark(student.endSemester) : "AB",
      formatMark(student.total),
      resolveGradeBand(rule, student.percentage).label,
    ]),
    styles: {
      font: "times",
      fontSize: 8,
      cellPadding: 3,
      textColor: AURORA.text,
      lineColor: TABLE_BORDER,
      lineWidth: 0.25,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [...AURORA.slate],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: [...AURORA.soft],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 30 },
      1: { halign: "center", cellWidth: 94, overflow: "hidden" },
      2: { cellWidth: 148 },
      3: { halign: "center", cellWidth: 58 },
      4: { halign: "center", cellWidth: 58 },
      5: { halign: "center", cellWidth: 64 },
      6: { halign: "center", cellWidth: 52 },
      7: { halign: "center", cellWidth: 36 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 1) {
        hookData.cell.styles.fontSize = 7
        hookData.cell.styles.overflow = "hidden"
      }

      if (hookData.section === "head" && hookData.column.index === 1) {
        hookData.cell.styles.fontSize = 7.5
      }
    },
    tableWidth: pageWidth - margin * 2,
    margin: { left: margin, right: margin, bottom: 44 },
  })
}

function drawFooters(pdf: jsPDF) {
  const totalPages = pdf.getNumberOfPages()
  const footerDate = formatLongDate(new Date())
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 32

  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page)
    pdf.setDrawColor(...AURORA.border)
    pdf.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28)
    pdf.setFont("times", "normal")
    pdf.setFontSize(9)
    pdf.setTextColor(...AURORA.muted)
    pdf.text(footerDate, margin, pageHeight - 12)
    pdf.text("Generated by EvalViz", pageWidth / 2, pageHeight - 12, { align: "center" })
    pdf.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 12, { align: "right" })
  }
}

export function buildClassReportPdf(options: DownloadClassReportOptions) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  })

  drawPageOne(options, pdf)
  drawPageTwo(options, pdf)
  drawFooters(pdf)

  return pdf
}

export function downloadClassReportPdf(options: DownloadClassReportOptions) {
  const pdf = buildClassReportPdf(options)
  const safeSection = options.section.sectionName.replace(/\s+/g, "-").toLowerCase()
  pdf.save(`${options.exportMeta.subjectCode}-grading-report-${safeSection}.pdf`)
}

export type { ExamType, GradingReportWeights }
