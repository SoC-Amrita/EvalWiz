"use server"

import prisma from "@/lib/db"
import { revalidatePath } from "next/cache"
import { requireRealWorkspace, requireWorkspaceManagerState } from "@/lib/workspace-guards"

export async function createAssessment(data: {
  name: string
  code: string
  description?: string
  maxMarks: number
  weightage: number
  category: string
  componentType: string
  isActive: boolean
  includeInAgg: boolean
  displayOrder: number
}) {
  const { activeWorkspace } = await requireWorkspaceManagerState()
  requireRealWorkspace(activeWorkspace, "Create or select an active course offering before adding assessments")

  await prisma.assessment.create({
    data: {
      ...data,
      offeringId: activeWorkspace.offeringId,
    }
  })
  
  revalidatePath("/dashboard/assessments")
  revalidatePath("/dashboard/marks")
  revalidatePath("/dashboard/analytics")
  return { success: true }
}

export async function updateAssessment(data: {
  assessmentId: string
  name: string
  code: string
  description?: string
  maxMarks: number
  weightage: number
  category: string
  componentType: string
  includeInAgg: boolean
  displayOrder: number
}) {
  const { activeWorkspace } = await requireWorkspaceManagerState()
  requireRealWorkspace(activeWorkspace, "Create or select an active course offering before updating assessments")

  const assessment = await prisma.assessment.findFirst({
    where: {
      id: data.assessmentId,
      offeringId: activeWorkspace.offeringId,
    },
    select: { id: true },
  })

  if (!assessment) {
    throw new Error("Assessment not found in the active workspace")
  }

  await prisma.assessment.update({
    where: { id: data.assessmentId },
    data: {
      name: data.name,
      code: data.code,
      description: data.description,
      maxMarks: data.maxMarks,
      weightage: data.weightage,
      category: data.category,
      componentType: data.componentType,
      includeInAgg: data.includeInAgg,
      displayOrder: data.displayOrder,
    },
  })

  revalidatePath("/dashboard/assessments")
  revalidatePath("/dashboard/marks")
  revalidatePath("/dashboard/analytics")
  return { success: true }
}

export async function toggleAssessmentStatus(id: string, currentStatus: boolean) {
  const { activeWorkspace } = await requireWorkspaceManagerState()
  requireRealWorkspace(activeWorkspace)
  const assessment = await prisma.assessment.findFirst({
    where: {
      id,
      offeringId: activeWorkspace.offeringId,
    },
    select: { id: true },
  })
  if (!assessment) {
    throw new Error("Assessment not found in the active workspace")
  }

  await prisma.assessment.update({
    where: { id },
    data: { isActive: !currentStatus }
  })
  
  revalidatePath("/dashboard/assessments")
  revalidatePath("/dashboard/marks")
  revalidatePath("/dashboard/analytics")
  return { success: true }
}

export async function deleteAssessment(id: string) {
  const { activeWorkspace } = await requireWorkspaceManagerState()
  requireRealWorkspace(activeWorkspace)
  const assessment = await prisma.assessment.findFirst({
    where: {
      id,
      offeringId: activeWorkspace.offeringId,
    },
    select: { id: true },
  })
  if (!assessment) {
    throw new Error("Assessment not found in the active workspace")
  }

  await prisma.assessment.delete({
    where: { id }
  })
  
  revalidatePath("/dashboard/assessments")
  revalidatePath("/dashboard/marks")
  revalidatePath("/dashboard/analytics")
  return { success: true }
}
