import type { CourseWorkspace, WorkspaceRoleView } from "@/lib/course-workspace"

import { inferSectionCodeFromLabel } from "@/lib/roll-number"

type WorkspaceLabelInput = Pick<
  CourseWorkspace,
  "subjectCode" | "subjectTitle" | "program" | "semester" | "academicYear" | "term" | "year" | "batchLabel"
>

export function hasRealWorkspace(workspace: Pick<CourseWorkspace, "offeringId">) {
  return Boolean(workspace.offeringId)
}

export function getRoleViewLabel(roleView: WorkspaceRoleView) {
  switch (roleView) {
    case "administrator":
      return "Administrator"
    case "mentor":
      return "Mentor"
    case "faculty":
      return "Faculty"
  }
}

export function formatWorkspaceCode(workspace: Pick<CourseWorkspace, "subjectCode">) {
  return workspace.subjectCode?.trim() || "Selected course"
}

export function formatWorkspaceIdentity(workspace: Pick<CourseWorkspace, "subjectCode" | "subjectTitle">) {
  return [workspace.subjectCode, workspace.subjectTitle].filter(Boolean).join(" ")
}

export function formatWorkspaceCycleLabel(workspace: Pick<CourseWorkspace, "academicYear" | "term">) {
  return [workspace.academicYear, workspace.term].filter(Boolean).join(" ")
}

export function formatWorkspaceProgramSummary(workspace: WorkspaceLabelInput) {
  return [
    workspace.program,
    workspace.semester ? `${workspace.semester} Semester` : "",
    workspace.year ? `Year ${workspace.year}` : "",
    workspace.batchLabel,
  ].filter(Boolean).join(" · ")
}

export function formatWorkspaceFullLabel(workspace: WorkspaceLabelInput) {
  return [
    formatWorkspaceIdentity(workspace),
    workspace.program,
    workspace.semester ? `${workspace.semester} Semester` : "",
    formatWorkspaceCycleLabel(workspace),
  ].filter(Boolean).join(" · ")
}

export function formatWorkspaceRoleHeading(
  roleLabel: string,
  workspace: Pick<CourseWorkspace, "subjectCode">
) {
  return `${roleLabel} view for ${formatWorkspaceCode(workspace)}`
}

export function formatCompactSectionName(sectionName: string, sectionCode?: string | null) {
  return sectionCode?.trim().toUpperCase() || inferSectionCodeFromLabel(sectionName) || sectionName
}

export function formatCompactProgramSectionName(section: {
  name: string
  programCode?: string | null
  sectionCode?: string | null
}) {
  const programCode = section.programCode?.trim().toUpperCase() || null
  const sectionCode = section.sectionCode?.trim().toUpperCase() || inferSectionCodeFromLabel(section.name) || null

  if (programCode && sectionCode) {
    return `${programCode} ${sectionCode}`
  }

  return formatCompactSectionName(section.name, section.sectionCode)
}

export function formatDetailedCompactSectionName(section: {
  name: string
  semester?: string | null
  programCode?: string | null
  sectionCode?: string | null
}) {
  const semester = section.semester?.trim() || null
  const programCode = section.programCode?.trim().toUpperCase() || null
  const sectionCode = section.sectionCode?.trim().toUpperCase() || inferSectionCodeFromLabel(section.name) || null

  if (semester && programCode && sectionCode) {
    return `${semester} ${programCode} ${sectionCode}`
  }

  return formatCompactSectionName(section.name, section.sectionCode)
}
