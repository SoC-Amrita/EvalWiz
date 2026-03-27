"use client"

import { useState, useEffect, useRef } from "react"
import Papa from "papaparse"
import type { Section, Assessment } from "@prisma/client"
import ExcelJS from "exceljs"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Upload, Download, AlertCircle, CheckCircle, FileSpreadsheet, FileText, Save } from "lucide-react"
import { fetchSectionData, fetchSectionExportData, type SectionExportData } from "./fetcher"
import { saveStudentMark, bulkUploadMarks } from "./actions"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"

type StudentRow = { id: string; rollNo: string; name: string; mark: number | null }
type ParsedCsvRow = { rollNo?: string; marks?: string }

function buildExportRows(data: SectionExportData) {
  return data.students.map((student) => {
    const baseRow: Record<string, string | number> = {
      "Roll Number": student.rollNo,
      "Student Name": student.name,
    }

    data.assessments.forEach((assessment) => {
      baseRow[`${assessment.name} (Maximum Marks: ${assessment.maxMarks})`] =
        student.marks[assessment.id] ?? ""
    })

    return baseRow
  })
}

function getReportTitle(data: SectionExportData, mode: "full" | "component") {
  return mode === "component" && data.assessments[0]
    ? `${data.assessments[0].name} Marks Report`
    : "Section Marks Report"
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function getExportFileStem(data: SectionExportData, mode: "full" | "component") {
  const sectionName = `Section_${data.section.name.replace(/\s+/g, "_")}`
  const scope =
    mode === "component" && data.assessments[0]
      ? data.assessments[0].code.replace(/\s+/g, "_")
      : "Full_Marks_Report"

  return `${sectionName}_${scope}`
}

export function MarksClient({ 
  sections, 
  assessments 
}: { 
  sections: Section[], 
  assessments: Assessment[] 
}) {
  const [activeSection, setActiveSection] = useState<string>("")
  const [activeAssessment, setActiveAssessment] = useState<string | null>(null)
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [dirtyMarks, setDirtyMarks] = useState<Record<string, string>>({})
  
  // CSV State
  const [openCsv, setOpenCsv] = useState(false)
  const [parsedData, setParsedData] = useState<{rollNo: string, marks: number}[]>([])
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [exportingKey, setExportingKey] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeAssessmentDetails = assessments.find(a => a.id === activeAssessment)

  useEffect(() => {
    const loadData = async () => {
      if (!activeSection || !activeAssessment) return

      setLoading(true)
      try {
        const data = await fetchSectionData(activeSection, activeAssessment)
        setStudents(data)
        setDirtyMarks({})
      } catch {
        toast.error("Failed to load students")
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [activeSection, activeAssessment])

  const handleMarkChange = (studentId: string, val: string) => {
    setDirtyMarks(prev => ({ ...prev, [studentId]: val }))
  }

  const handleSaveIndividual = async (studentId: string) => {
    const val = dirtyMarks[studentId]
    if (!val || !activeAssessment) return
    
    try {
      await saveStudentMark(studentId, activeAssessment, val)
      toast.success("Mark saved")
      
      // Update local state without full refetch
      setStudents(prev => prev.map(s => 
        s.id === studentId ? { ...s, mark: parseFloat(val) } : s
      ))
      
      // Clear dirty state for this cell
      setDirtyMarks(prev => {
        const next = { ...prev }
        delete next[studentId]
        return next
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save mark")
    }
  }

  const processFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<ParsedCsvRow>) => {
        const errors: string[] = []
        const marksData: {rollNo: string, marks: number}[] = []

        results.data.forEach((row, i) => {
          if (!row.rollNo || row.marks === undefined) {
            errors.push(`Row ${i+1}: Missing rollNo or marks column`)
            return
          }
          
          const rollNo = String(row.rollNo).trim()
          const marks = parseFloat(row.marks)
          
          if (isNaN(marks)) {
            errors.push(`Row ${i+1}: Invalid marks value for ${rollNo}`)
            return
          }
          
          if (activeAssessmentDetails && marks > activeAssessmentDetails.maxMarks) {
            errors.push(`Row ${i+1}: Marks (${marks}) exceed maximum allowed (${activeAssessmentDetails.maxMarks}) for ${rollNo}`)
            return
          }

          marksData.push({ rollNo, marks })
        })

        setParsedData(marksData)
        setCsvErrors(errors)
      },
      error: (e) => {
        setCsvErrors([e.message])
      }
    })
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
      processFile(file)
    } else {
      toast.error("Please drop a valid .csv file")
    }
  }

  const submitBulkMarks = async () => {
    if (parsedData.length === 0 || !activeSection || !activeAssessment) return
    setLoading(true)
    try {
      const result = await bulkUploadMarks(activeSection, activeAssessment, parsedData)
      if (result.errorCount > 0) {
        toast.warning(`Uploaded with ${result.errorCount} errors. See logs.`)
      } else {
        toast.success(`Successfully uploaded ${result.successCount} marks`)
        setOpenCsv(false)
        setParsedData([])
        setCsvErrors([])
        const refreshedData = await fetchSectionData(activeSection, activeAssessment)
        setStudents(refreshedData)
        setDirtyMarks({})
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk upload failed")
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const csvContent = "rollNo,marks\nCB.EN.U4CYS23A001,45.5"
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "marks_template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportSectionXlsx = async (mode: "full" | "component") => {
    if (!activeSection || (mode === "component" && !activeAssessment)) return

    setExportingKey(`${mode}-xlsx`)
    try {
      const exportData = await fetchSectionExportData(
        activeSection,
        mode === "component" ? activeAssessment : null
      )

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet(`Section ${exportData.section.name}`)
      const columnCount = 2 + exportData.assessments.length
      const tableHeaderRowNumber = 12

      worksheet.mergeCells(1, 1, 1, columnCount)
      worksheet.getCell(1, 1).value = exportData.meta.institution
      worksheet.getCell(1, 1).font = { name: "Cambria", size: 16, bold: true }
      worksheet.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" }

      worksheet.mergeCells(2, 1, 2, columnCount)
      worksheet.getCell(2, 1).value = exportData.meta.school
      worksheet.getCell(2, 1).font = { name: "Cambria", size: 14, bold: true }
      worksheet.getCell(2, 1).alignment = { horizontal: "center", vertical: "middle" }

      worksheet.mergeCells(3, 1, 3, columnCount)
      worksheet.getCell(3, 1).value = exportData.meta.department
      worksheet.getCell(3, 1).font = { name: "Cambria", size: 14, bold: true }
      worksheet.getCell(3, 1).alignment = { horizontal: "center", vertical: "middle" }

      worksheet.mergeCells(4, 1, 4, columnCount)
      worksheet.getCell(4, 1).value = getReportTitle(exportData, mode)
      worksheet.getCell(4, 1).font = { name: "Cambria", size: 12, bold: true }
      worksheet.getCell(4, 1).alignment = { horizontal: "center", vertical: "middle" }

      worksheet.mergeCells(5, 1, 5, columnCount)
      worksheet.getCell(5, 1).value = `Subject Code: ${exportData.meta.subjectCode}     Subject: ${exportData.meta.subjectTitle}`

      worksheet.mergeCells(6, 1, 6, columnCount)
      worksheet.getCell(6, 1).value = `Program: ${exportData.meta.program}     Semester: ${exportData.meta.semester}     Year: ${exportData.meta.year}`

      worksheet.mergeCells(7, 1, 7, columnCount)
      worksheet.getCell(7, 1).value = `Academic Year: ${exportData.meta.academicYear}     Term: ${exportData.meta.term}`

      worksheet.mergeCells(8, 1, 8, columnCount)
      worksheet.getCell(8, 1).value = `Mentors: ${exportData.meta.mentors.join(", ") || "—"}`

      worksheet.mergeCells(9, 1, 9, columnCount)
      worksheet.getCell(9, 1).value = `Course Type: ${exportData.meta.courseType}     Evaluation Pattern: ${exportData.meta.evaluationPattern}`

      worksheet.mergeCells(10, 1, 10, columnCount)
      worksheet.getCell(10, 1).value = `Section / Group: ${exportData.meta.sectionLabel}     Course Faculty: ${exportData.meta.courseFaculty}`

      worksheet.mergeCells(11, 1, 11, columnCount)
      worksheet.getCell(11, 1).value =
        mode === "component" && exportData.assessments[0]
          ? `Report Scope: ${exportData.assessments[0].name}`
          : "Report Scope: Complete Marks Report"

      for (let rowNumber = 5; rowNumber <= 11; rowNumber += 1) {
        worksheet.getRow(rowNumber).font = { name: "Calibri", size: 10, bold: true }
        worksheet.getRow(rowNumber).alignment = { horizontal: "left", vertical: "middle", wrapText: true }
      }

      const headerRow = worksheet.getRow(tableHeaderRowNumber)
      headerRow.values = [
        "Roll Number",
        "Student Name",
        ...exportData.assessments.map(
          (assessment) => `${assessment.name} (Maximum Marks: ${assessment.maxMarks})`
        ),
      ]
      headerRow.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } }
      headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFB01A48" },
      }

      buildExportRows(exportData).forEach((row, index) => {
        const worksheetRow = worksheet.getRow(tableHeaderRowNumber + 1 + index)
        worksheetRow.values = Object.values(row)
        worksheetRow.font = { name: "Calibri", size: 10 }
        worksheetRow.alignment = { vertical: "middle", wrapText: true }
      })

      worksheet.columns = [
        { width: 18 },
        { width: 30 },
        ...exportData.assessments.map(() => ({ width: 28 })),
      ]

      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD6D6D6" } },
            left: { style: "thin", color: { argb: "FFD6D6D6" } },
            bottom: { style: "thin", color: { argb: "FFD6D6D6" } },
            right: { style: "thin", color: { argb: "FFD6D6D6" } },
          }
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      triggerDownload(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `${getExportFileStem(exportData, mode)}.xlsx`
      )
      toast.success(
        mode === "component"
          ? "Component marks exported to XLSX"
          : "Complete section marks exported to XLSX"
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export XLSX")
    } finally {
      setExportingKey(null)
    }
  }

  const exportSectionPdf = async (mode: "full" | "component") => {
    if (!activeSection || (mode === "component" && !activeAssessment)) return

    setExportingKey(`${mode}-pdf`)
    try {
      const exportData = await fetchSectionExportData(
        activeSection,
        mode === "component" ? activeAssessment : null
      )

      const pdf = new jsPDF({
        orientation: exportData.assessments.length > 3 ? "landscape" : "portrait",
        unit: "pt",
        format: "a4",
      })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 40
      const reportTitle = getReportTitle(exportData, mode)
      const contentWidth = pageWidth - margin * 2
      const metaItems = [
        ["Subject Code", exportData.meta.subjectCode],
        ["Subject", exportData.meta.subjectTitle],
        ["Program", exportData.meta.program],
        ["Semester", exportData.meta.semester],
        ["Year", exportData.meta.year],
        ["Academic Year", exportData.meta.academicYear],
        ["Term", exportData.meta.term],
        ["Course Type", exportData.meta.courseType],
        ["Evaluation Pattern", exportData.meta.evaluationPattern],
        ["Section / Group", exportData.meta.sectionLabel],
        [null, null],
        [
          "Report Scope",
          mode === "component" && exportData.assessments[0]
            ? exportData.assessments[0].name
            : "Complete Marks Report",
        ],
      ] as const

      const drawInlineLabelValue = (label: string, value: string, x: number, y: number, width: number, render: boolean) => {
        pdf.setFont("times", "bold")
        pdf.setFontSize(12)
        const labelText = `${label}: `
        const labelWidth = pdf.getTextWidth(labelText)
        pdf.setFont("times", "normal")
        pdf.setFontSize(12)
        const lines = pdf.splitTextToSize(value, Math.max(width - labelWidth - 4, 48))

        if (render) {
          pdf.setFont("times", "bold")
          pdf.setFontSize(12)
          pdf.setTextColor(51, 65, 85)
          pdf.text(labelText, x, y)
          pdf.setFont("times", "normal")
          pdf.setFontSize(12)
          pdf.setTextColor(15, 23, 42)
          pdf.text(lines, x + labelWidth, y)
        }

        return lines.length
      }

      const drawPrimaryHeader = (render: boolean) => {
        if (render) {
          pdf.setFillColor(255, 247, 237)
          pdf.rect(0, 0, pageWidth, 92, "F")
          pdf.setDrawColor(79, 70, 229)
          pdf.setLineWidth(2)
          pdf.line(margin, 88, pageWidth - margin, 88)
          pdf.setFont("times", "bold")
          pdf.setFontSize(9)
          pdf.setTextColor(99, 102, 241)
          pdf.text("EVALWIZ", margin, 24)
          pdf.setFontSize(13)
          pdf.setTextColor(159, 18, 57)
          pdf.text(reportTitle.toUpperCase(), pageWidth - margin, 24, { align: "right" })
          pdf.setTextColor(15, 23, 42)
          pdf.setFontSize(13)
          pdf.text(exportData.meta.school, margin, 48)
          pdf.setFontSize(11)
          pdf.text(exportData.meta.department, margin, 62)
          pdf.setFontSize(15)
          pdf.text(exportData.meta.institution, margin, 78)
        }

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

            pdf.setFont("times", "bold")
            pdf.setFontSize(12)
            const labelText = `${String(label)}: `
            const labelWidth = pdf.getTextWidth(labelText)
            const availableValueWidth = Math.max(metaColumnWidth - labelWidth - 4, 48)
            pdf.setFont("times", "normal")
            pdf.setFontSize(12)
            const valueLines = pdf.splitTextToSize(String(value), availableValueWidth)

            return {
              hasLabel,
              labelText,
              labelWidth,
              valueLines: valueLines.slice(0, 2),
              lineCount: Math.max(1, valueLines.slice(0, 2).length),
            }
          })

          const rowHeight = Math.max(...rowMetrics.map((item) => item.lineCount)) * 13 + 2
          if (render) {
            rowItems.forEach((_, column) => {
              const metaX = margin + column * (metaColumnWidth + metaGapX)
              const item = rowMetrics[column]
              if (!item.hasLabel) {
                return
              }
              pdf.setFont("times", "bold")
              pdf.setFontSize(12)
              pdf.setTextColor(51, 65, 85)
              pdf.text(item.labelText, metaX, metaCursorY)
              pdf.setFont("times", "normal")
              pdf.setFontSize(12)
              pdf.setTextColor(15, 23, 42)
              pdf.text(item.valueLines, metaX + item.labelWidth, metaCursorY)
            })
          }

          metaCursorY += rowHeight + metaGapY
        }

        const mentorsLineCount = drawInlineLabelValue(
          "Mentors",
          exportData.meta.mentors.join(", ") || "—",
          margin,
          metaCursorY + 4,
          contentWidth,
          render
        )
        const facultyLineY = metaCursorY + mentorsLineCount * 15 + 10
        const facultyLineCount = drawInlineLabelValue(
          "Course Faculty",
          exportData.meta.courseFaculty,
          margin,
          facultyLineY,
          contentWidth,
          render
        )

        return facultyLineY + facultyLineCount * 15
      }

      const drawContinuationHeader = () => {
        pdf.setFillColor(255, 247, 237)
        pdf.rect(0, 0, pageWidth, 46, "F")
        pdf.setDrawColor(79, 70, 229)
        pdf.setLineWidth(1.5)
        pdf.line(margin, 42, pageWidth - margin, 42)
        pdf.setFont("times", "bold")
        pdf.setFontSize(11)
        pdf.setTextColor(159, 18, 57)
        pdf.text(reportTitle.toUpperCase(), margin, 24)
        pdf.setFont("times", "normal")
        pdf.setFontSize(9)
        pdf.setTextColor(51, 65, 85)
        pdf.text(
          `${exportData.meta.subjectCode} · ${exportData.meta.subjectTitle}`,
          pageWidth - margin,
          24,
          { align: "right" }
        )
      }

      const tableStartY = drawPrimaryHeader(false) + 16

      autoTable(pdf, {
        startY: tableStartY,
        theme: "grid",
        head: [[
          "Roll Number",
          "Student Name",
          ...exportData.assessments.map(
            (assessment) => `${assessment.name} (Maximum Marks: ${assessment.maxMarks})`
          ),
        ]],
        body: exportData.students.map((student) => [
          student.rollNo,
          student.name,
          ...exportData.assessments.map(
            (assessment) => student.marks[assessment.id]?.toString() ?? "-"
          ),
        ]),
        styles: {
          font: "times",
          fontSize: 8,
          cellPadding: 4,
        },
        headStyles: {
          fillColor: [51, 65, 85],
        },
        margin: { top: 56, left: margin, right: margin, bottom: 32 },
        didDrawPage: (data) => {
          if (data.pageNumber === 1) {
            drawPrimaryHeader(true)
          } else {
            drawContinuationHeader()
          }
          pdf.setFont("times", "normal")
          pdf.setFontSize(9)
          pdf.setTextColor(100, 116, 139)
          pdf.text(
            `${exportData.meta.subjectCode} · ${exportData.meta.subjectTitle}`,
            margin,
            pageHeight - 14
          )
          pdf.text(`Page ${data.pageNumber}`, pageWidth / 2, pageHeight - 14, {
            align: "center",
          })
          pdf.text(exportData.meta.institution, pageWidth - margin, pageHeight - 14, {
            align: "right",
          })
        },
      })

      pdf.save(`${getExportFileStem(exportData, mode)}.pdf`)
      toast.success(
        mode === "component"
          ? "Component marks exported to PDF"
          : "Complete section marks exported to PDF"
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export PDF")
    } finally {
      setExportingKey(null)
    }
  }

  const canEdit = activeSection && activeAssessment
  const canExportSection = Boolean(activeSection)
  const canExportComponent = Boolean(activeSection && activeAssessment)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Section</label>
          <Select value={activeSection} onValueChange={(val) => setActiveSection(val || "")}>
            <SelectTrigger className="bg-white dark:bg-slate-900">
              {activeSection ? sections.find(s => s.id === activeSection)?.name || "" : <span className="text-slate-500">Choose section...</span>}
            </SelectTrigger>
            <SelectContent>
              {sections.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Assessment</label>
          <Select value={activeAssessment} onValueChange={(val) => setActiveAssessment(val || "")}>
            <SelectTrigger className="bg-white dark:bg-slate-900">
              {activeAssessment ? `${assessments.find(a => a.id === activeAssessment)?.name} (${assessments.find(a => a.id === activeAssessment)?.maxMarks} marks)` : <span className="text-slate-500">Choose component...</span>}
            </SelectTrigger>
            <SelectContent>
              {assessments.map(a => (
                <SelectItem key={a.id} value={a.id}>{`${a.name} (${a.maxMarks} marks)`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-end pb-0 md:pb-0.5">
          <Dialog open={openCsv} onOpenChange={setOpenCsv}>
            <DialogTrigger render={
              <Button 
                variant="outline" 
                disabled={!canEdit}
                className="w-full bg-white dark:bg-slate-900"
              />
            }>
              <Upload className="w-4 h-4 mr-2" />
              Bulk CSV Upload
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Import Component Marks</DialogTitle>
                <DialogDescription>
                  Upload marks for <span className="font-bold text-indigo-600 dark:text-indigo-400">{activeAssessmentDetails?.name}</span> mapping to <span className="font-bold text-indigo-600 dark:text-indigo-400">Section {sections.find(s => s.id === activeSection)?.name}</span>.
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-6">
                <Button variant="outline" size="sm" className="mb-4" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>

                <div className="flex items-center justify-center w-full">
                  <label 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 ${isDragging ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-300 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"} border-dashed rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                   >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className={`w-8 h-8 mb-2 ${isDragging ? "text-indigo-500" : "text-slate-400"}`} />
                      <p className="text-sm text-slate-500"><span className="font-medium text-indigo-600">Click to upload</span> or drag and drop CSV file</p>
                    </div>
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} ref={fileInputRef} />
                  </label>
                </div>

                {csvErrors.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md max-h-32 overflow-y-auto">
                    <div className="flex items-center text-red-800 mb-2 font-medium text-sm">
                      <AlertCircle className="w-4 h-4 mr-2" /> Errors
                    </div>
                    <ul className="text-xs text-red-600 list-disc pl-5">
                      {csvErrors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}

                {parsedData.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center mb-2 font-medium text-sm text-emerald-700">
                      <CheckCircle className="w-4 h-4 mr-2" /> Ready to Import: {parsedData.length} marks
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenCsv(false)}>Cancel</Button>
                <Button onClick={submitBulkMarks} disabled={loading || parsedData.length === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20">
                  {loading ? "Uploading..." : `Upload ${parsedData.length} Records`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Export Section Marks
            </h2>
            <p className="text-xs text-slate-500">
              Download a full section report or just the currently selected component.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Button
              variant="outline"
              disabled={!canExportSection || exportingKey !== null}
              onClick={() => exportSectionXlsx("full")}
              className="justify-start bg-white dark:bg-slate-900"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {exportingKey === "full-xlsx" ? "Exporting..." : "Full XLSX"}
            </Button>
            <Button
              variant="outline"
              disabled={!canExportSection || exportingKey !== null}
              onClick={() => exportSectionPdf("full")}
              className="justify-start bg-white dark:bg-slate-900"
            >
              <FileText className="mr-2 h-4 w-4" />
              {exportingKey === "full-pdf" ? "Exporting..." : "Full PDF"}
            </Button>
            <Button
              variant="outline"
              disabled={!canExportComponent || exportingKey !== null}
              onClick={() => exportSectionXlsx("component")}
              className="justify-start bg-white dark:bg-slate-900"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {exportingKey === "component-xlsx" ? "Exporting..." : "Component XLSX"}
            </Button>
            <Button
              variant="outline"
              disabled={!canExportComponent || exportingKey !== null}
              onClick={() => exportSectionPdf("component")}
              className="justify-start bg-white dark:bg-slate-900"
            >
              <FileText className="mr-2 h-4 w-4" />
              {exportingKey === "component-pdf" ? "Exporting..." : "Component PDF"}
            </Button>
          </div>
        </div>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {loading && students.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-500">Loading students...</div>
        ) : !canEdit ? (
          <div className="h-64 flex items-center justify-center text-slate-500">
            Select a section and assessment to begin data entry.
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-320px)]">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[150px]">Roll Number</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead className="w-[200px] text-right">
                    Score (Max {activeAssessmentDetails?.maxMarks})
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => {
                  const isDirty = dirtyMarks[student.id] !== undefined
                  const currentValue = isDirty ? dirtyMarks[student.id] : student.mark ?? ""
                  
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-mono font-medium text-slate-600 dark:text-slate-400">
                        {student.rollNo}
                      </TableCell>
                      <TableCell className="font-medium">
                        {student.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Input 
                            type="number"
                            step="0.5"
                            className={`w-24 text-right ${isDirty ? 'border-yellow-400 focus-visible:ring-yellow-400' : ''}`}
                            value={currentValue}
                            onChange={(e) => handleMarkChange(student.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && isDirty) {
                                handleSaveIndividual(student.id)
                              }
                            }}
                          />
                          {isDirty ? (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-9 w-9 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                              onClick={() => handleSaveIndividual(student.id)}
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                          ) : (
                            <div className="w-9 h-9" /> // spacer to prevent layout shift
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </div>
    </>
  )
}
