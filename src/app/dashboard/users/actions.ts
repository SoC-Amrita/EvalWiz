"use server"

import { revalidatePath } from "next/cache"

import { getSessionUser } from "@/lib/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import prisma from "@/lib/db"
import { buildNameFields } from "@/lib/user-names"
import { canManageUsers } from "@/lib/user-roles"

export async function createUserAccount(data: {
  title: string
  firstName: string
  lastName: string
  email: string
  password?: string
  isAdmin: boolean
}) {
  const caller = await getSessionUser()
  if (!canManageUsers(caller)) {
    throw new Error("Unauthorized")
  }

  const password = data.password?.trim()
  if (!password) {
    throw new Error("Password is required")
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long")
  }

  // Check email uniqueness in Prisma before touching Supabase.
  const existing = await prisma.user.findUnique({
    where: { email: data.email.trim() },
  })
  if (existing) {
    throw new Error("A user with this email already exists")
  }

  // 1. Create the user in Supabase Auth (sets password, handles hashing).
  const admin = createSupabaseAdminClient()
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: data.email.trim(),
    password,
    email_confirm: true, // skip email confirmation for internal accounts
  })

  if (authError || !authData.user) {
    throw new Error(authError?.message ?? "Failed to create auth account")
  }

  const nameFields = buildNameFields(data)

  // 2. Create the Prisma User row, keyed by the Supabase UUID.
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        supabaseId: authData.user.id,
        ...nameFields,
        email: data.email.trim(),
        role: "FACULTY",
        isAdmin: data.isAdmin,
      },
    })

    await tx.faculty.create({
      data: {
        userId: user.id,
        name: nameFields.name,
      },
    })
  })

  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard/sections")
  revalidatePath("/dashboard/reports")
  return { success: true }
}

export async function updateUserIdentity(data: {
  userId: string
  title: string
  firstName: string
  lastName: string
  email: string
  isAdmin: boolean
}) {
  const caller = await getSessionUser()
  if (!canManageUsers(caller)) {
    throw new Error("Unauthorized")
  }

  const nameFields = buildNameFields(data)

  // If the email changed, sync it to Supabase Auth as well.
  const existing = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { supabaseId: true, email: true },
  })

  if (!existing) {
    throw new Error("User not found")
  }

  if (existing.supabaseId && existing.email !== data.email.trim()) {
    const admin = createSupabaseAdminClient()
    const { error } = await admin.auth.admin.updateUserById(existing.supabaseId, {
      email: data.email.trim(),
    })
    if (error) {
      throw new Error(`Failed to update email in auth: ${error.message}`)
    }
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: data.userId },
      data: {
        ...nameFields,
        email: data.email.trim(),
        role: "FACULTY",
        isAdmin: data.isAdmin,
      },
      include: { faculty: true },
    })

    if (user.faculty) {
      await tx.faculty.update({
        where: { id: user.faculty.id },
        data: { name: nameFields.name },
      })
    }
  })

  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard/sections")
  revalidatePath("/dashboard/reports")
  return { success: true }
}

export async function resetUserPassword(userId: string, password?: string) {
  const caller = await getSessionUser()
  if (!canManageUsers(caller)) {
    throw new Error("Unauthorized")
  }

  const nextPassword = password?.trim()
  if (!nextPassword) {
    throw new Error("New password is required")
  }
  if (nextPassword.length < 8) {
    throw new Error("New password must be at least 8 characters long")
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { supabaseId: true },
  })

  if (!user) {
    throw new Error("User not found")
  }

  if (!user.supabaseId) {
    throw new Error("This user has not been migrated to the new auth system yet")
  }

  const admin = createSupabaseAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.supabaseId, {
    password: nextPassword,
  })

  if (error) {
    throw new Error(`Failed to reset password: ${error.message}`)
  }

  revalidatePath("/dashboard/users")
  return { success: true }
}

export async function deleteUserAccount(userId: string) {
  const caller = await getSessionUser()
  if (!canManageUsers(caller)) {
    throw new Error("Unauthorized")
  }

  if (caller?.id === userId) {
    throw new Error("You cannot delete the account you are currently signed in with")
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isAdmin: true, supabaseId: true },
  })

  if (!user) {
    throw new Error("User not found")
  }

  if (user.isAdmin) {
    const adminCount = await prisma.user.count({ where: { isAdmin: true } })
    if (adminCount <= 1) {
      throw new Error("At least one administrator account must remain")
    }
  }

  // Delete Prisma record first (FK cascades handle Faculty, enrollments etc).
  await prisma.user.delete({ where: { id: userId } })

  // Then remove from Supabase Auth if migrated.
  if (user.supabaseId) {
    const admin = createSupabaseAdminClient()
    await admin.auth.admin.deleteUser(user.supabaseId)
  }

  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard/sections")
  revalidatePath("/dashboard/reports")
  return { success: true }
}
