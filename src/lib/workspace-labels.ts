import type { CourseWorkspace } from "@/lib/course-workspace"

import { inferSectionCodeFromLabel } from "@/lib/roll-number"

type WorkspaceLabelInput = Pick<
  CourseWorkspace,
  "subjectCode" | "subjectTitle" | "program" | "semester" | "academicYear" | "term" | "year" | "batchLabel"
>

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

export function formatCompactSectionName(sectionName: string, sectionCode?: string | null) {
  return sectionCode?.trim().toUpperCase() || inferSectionCodeFromLabel(sectionName) || sectionName
}
