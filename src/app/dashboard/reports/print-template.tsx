"use client"

import React from "react"
import { REPORT_METRICS, type ReportMetricKey } from "@/lib/assessment-structure"
import { ReportMeta, SectionReportData } from "./types"

/** Stat row in the print template */
function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center", paddingRight: 24 }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{value}</div>
    </div>
  )
}

function BarSummaryChart({
  title,
  labels,
  values,
  colors,
  maxValue,
}: {
  title: string
  labels: string[]
  values: number[]
  colors: string[]
  maxValue: number
}) {
  const width = 480
  const height = 220
  const chartHeight = 138
  const leftAxis = 36
  const gap = 18
  const barWidth = Math.max(30, Math.floor((width - leftAxis - 40) / Math.max(labels.length, 1)) - gap)

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, backgroundColor: "#ffffff" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 8 }}>{title}</div>
      <svg width={width} height={height}>
        <line x1={leftAxis} y1={16} x2={leftAxis} y2={chartHeight + 16} stroke="#cbd5e1" />
        <line x1={leftAxis} y1={chartHeight + 16} x2={width - 10} y2={chartHeight + 16} stroke="#cbd5e1" />
        {values.map((value, index) => {
          const barHeight = maxValue > 0 ? (value / maxValue) * chartHeight : 0
          const x = 54 + index * (barWidth + gap)
          const y = chartHeight + 16 - barHeight
          return (
            <g key={`${labels[index]}-${index}`}>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx={4} fill={colors[index % colors.length]} />
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#334155">
                {value.toFixed(1)}
              </text>
              <text x={x + barWidth / 2} y={chartHeight + 34} textAnchor="middle" fontSize={10} fill="#64748b">
                {labels[index]}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Section analytics table for one section */
function SectionTable({ row }: { row: SectionReportData }) {
  const tdStyle: React.CSSProperties = {
    border: "1px solid #cbd5e1",
    padding: "5px 8px",
    textAlign: "center",
    fontSize: 10,
    fontFamily: "monospace",
  }

  const thStyle: React.CSSProperties = {
    border: "1px solid #cbd5e1",
    padding: "5px 8px",
    textAlign: "center",
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    backgroundColor: "#f8fafc",
    color: "#475569",
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
      <thead>
        <tr>
          <th style={{ ...thStyle, textAlign: "left", width: "28%" }}>Component</th>
          <th style={thStyle}>Out of</th>
          <th style={thStyle}>Mean</th>
          <th style={thStyle}>Median</th>
          <th style={thStyle}>Mode</th>
          <th style={thStyle}>Std Dev</th>
          <th style={thStyle}>Min</th>
          <th style={thStyle}>Max</th>
        </tr>
      </thead>
      <tbody>
        {REPORT_METRICS.map((metric) => {
          const stat = row[metric.key]
          return (
            <tr key={metric.key}>
              <td style={{ ...tdStyle, textAlign: "left", fontWeight: 600, color: metric.color, fontFamily: "inherit" }}>
                {metric.label}
              </td>
              <td style={{ ...tdStyle, color: "#64748b" }}>{stat.outOf}</td>
              <td style={{ ...tdStyle, fontWeight: 700 }}>{stat.avg.toFixed(2)}</td>
              <td style={tdStyle}>{stat.median.toFixed(2)}</td>
              <td style={{ ...tdStyle, color: "#64748b" }}>{stat.mode}</td>
              <td style={{ ...tdStyle, color: "#64748b" }}>{stat.stdDev.toFixed(2)}</td>
              <td style={{ ...tdStyle, color: "#dc2626" }}>{stat.min.toFixed(2)}</td>
              <td style={{ ...tdStyle, color: "#16a34a" }}>{stat.max.toFixed(2)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Full printable report — rendered inside a hidden div, captured by html-to-image */
export function PrintReport({
  id,
  rows,
  isCourse,
  reportMeta,
}: {
  id: string
  rows: SectionReportData[]
  isCourse: boolean
  reportMeta: ReportMeta
}) {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric"
  })

  const totalStudents = isCourse
    ? rows.reduce((sum, r) => sum + r.totalStudents, 0)
    : rows[0]?.totalStudents ?? 0

  return (
    <div
      id={id}
      style={{
        width: 1122, // A4 landscape width @96dpi
        fontFamily: "'Segoe UI', Arial, sans-serif",
        backgroundColor: "#ffffff",
        color: "#1e293b",
        padding: "40px 48px",
        boxSizing: "border-box",
      }}
    >
      {/* ---- HEADER ---- */}
      <div style={{ borderBottom: "3px solid #4f46e5", paddingBottom: 12, marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6366f1" }}>
                {reportMeta.appName}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#9f1239", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {isCourse ? "Consolidated Course Performance Report" : "Section Performance Report"}
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", lineHeight: 1.15 }}>
              {reportMeta.institution}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Generated on</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{today}</div>
          </div>
        </div>

        {/* Metadata chips */}
        <div style={{ display: "flex", gap: 28, marginTop: 16, flexWrap: "wrap" }}>
          <StatBlock label="Subject Code" value={reportMeta.subjectCode} />
          <StatBlock label="Subject" value={reportMeta.subjectTitle} />
          <StatBlock label="Academic Year" value={reportMeta.academicYear} />
          <StatBlock label="Term" value={reportMeta.term} />
          <StatBlock label="Course" value={reportMeta.course} />
          <StatBlock label="Year" value={reportMeta.year} />
          <StatBlock label="Semester No." value={reportMeta.semester} />
          <StatBlock
            label={isCourse ? "No. of Sections" : "Section"}
            value={
              isCourse
                ? rows.length.toString()
                : (rows[0]?.sectionName ?? "")
            }
          />
          {isCourse ? (
            <>
              <StatBlock label="Total Enrollment" value={totalStudents.toString()} />
              <StatBlock label="Course Mean" value={`${(rows.reduce((s, r) => s + r.overall.avg, 0) / Math.max(rows.length, 1)).toFixed(1)} / 100`} />
            </>
          ) : (
            <>
              <StatBlock label="Section" value={rows[0]?.sectionName ?? ""} />
              <StatBlock label="Faculty" value={rows[0]?.facultyName ?? "—"} />
              <StatBlock label="Class Strength" value={totalStudents.toString()} />
              <StatBlock label="Section Mean" value={`${rows[0]?.overall.avg.toFixed(1)} / 100`} />
            </>
          )}
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
          <div style={{ fontSize: 11, color: "#334155" }}>
            <strong>Mentors:</strong> {reportMeta.mentorNames.join(", ") || "—"}
          </div>
          <div style={{ fontSize: 11, color: "#334155" }}>
            <strong>{isCourse ? "Course Team" : "Course Faculty"}:</strong> {isCourse ? (reportMeta.courseTeamNames.join(", ") || "—") : (rows[0]?.facultyName ?? "—")}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 24 }}>
        <BarSummaryChart
          title="Weighted Mean by Component"
          labels={REPORT_METRICS.map((metric) => metric.shortLabel)}
          values={REPORT_METRICS.map((metric) => {
            const values = rows.map((row) => row[metric.key].avg)
            return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
          })}
          colors={REPORT_METRICS.map((metric) => metric.color)}
          maxValue={Math.max(...REPORT_METRICS.map((metric) => rows[0]?.[metric.key].outOf ?? 0), 100)}
        />
        <BarSummaryChart
          title={isCourse ? "Section-wise Overall Mean" : "Section Snapshot by Component"}
          labels={isCourse ? rows.map((row) => row.sectionName) : REPORT_METRICS.map((metric) => metric.shortLabel)}
          values={
            isCourse
              ? rows.map((row) => row.overall.avg)
              : REPORT_METRICS.map((metric) => rows[0]?.[metric.key].avg ?? 0)
          }
          colors={isCourse ? rows.map(() => "#6366f1") : REPORT_METRICS.map((metric) => metric.color)}
          maxValue={isCourse ? 100 : Math.max(...REPORT_METRICS.map((metric) => rows[0]?.[metric.key].outOf ?? 0), 100)}
        />
      </div>

      {/* ---- BODY: per-section blocks ---- */}
      {rows.map((row) => (
        <div key={row.sectionId} style={{ marginBottom: 32, pageBreakInside: "avoid" }}>
          {/* section sub-header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            backgroundColor: "#f1f5f9",
            borderLeft: "4px solid #6366f1",
            padding: "8px 14px",
            marginBottom: 10,
          }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{row.sectionName}</span>
              {row.facultyName && (
                <span style={{ fontSize: 10, color: "#475569", marginLeft: 12 }}>Faculty: {row.facultyName}</span>
              )}
            </div>
            <span style={{ fontSize: 10, color: "#475569" }}>Class Strength: {row.totalStudents}</span>
          </div>

          <SectionTable row={row} />
        </div>
      ))}

      {/* ---- COURSE TOTALS (only for multi-section course view) ---- */}
      {isCourse && rows.length > 1 && (() => {
        // Compute weighted-average across all sections
        const weights = rows.map(r => r.totalStudents)
        const totalW = weights.reduce((a, b) => a + b, 0)
        const wAvg = (key: ReportMetricKey) =>
          totalW > 0 ? (rows.reduce((s, r, i) => s + (r[key] as { avg: number }).avg * weights[i], 0) / totalW).toFixed(2) : "—"

        return (
          <div style={{ borderTop: "2px solid #e2e8f0", marginTop: 8, paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", marginBottom: 8 }}>
              Course-Wide Weighted Averages
            </div>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {["Component", ...REPORT_METRICS.map((metric) => `${metric.shortLabel} / ${rows[0][metric.key].outOf}`)].map(h => (
                    <th key={h} style={{
                      border: "1px solid #cbd5e1", padding: "5px 10px",
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.05em", backgroundColor: "#f8fafc", color: "#475569",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: "1px solid #cbd5e1", padding: "5px 10px", fontSize: 10, fontWeight: 600 }}>Weighted Mean</td>
                  {REPORT_METRICS.map((metric) => (
                    <td key={metric.key} style={{ border: "1px solid #cbd5e1", padding: "5px 10px", fontSize: 10, textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: metric.color }}>
                      {wAvg(metric.key)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* Footer */}
      <div style={{ marginTop: 32, paddingTop: 12, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", fontSize: 9, color: "#94a3b8" }}>
        <span>{reportMeta.appName} - {reportMeta.subjectCode} Academic Report</span>
        <span>Developed by {reportMeta.developer}</span>
        <span>{today}</span>
      </div>
    </div>
  )
}
