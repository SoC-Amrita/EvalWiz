"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
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
  const session = await auth()
  if (!canManageUsers(session?.user)) {
    throw new Error("Unauthorized")
  }

  const existing = await prisma.user.findUnique({
    where: { email: data.email.trim() },
  })
  if (existing) {
    throw new Error("A user with this email already exists")
  }

  const password =
    data.password?.trim() || (data.isAdmin ? "admin123" : "faculty123")
  const hashedPassword = await bcrypt.hash(password, 10)
  const nameFields = buildNameFields(data)

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        ...nameFields,
        email: data.email.trim(),
        password: hashedPassword,
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
  const session = await auth()
  if (!canManageUsers(session?.user)) {
    throw new Error("Unauthorized")
  }

  const nameFields = buildNameFields(data)

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
  const session = await auth()
  if (!canManageUsers(session?.user)) {
    throw new Error("Unauthorized")
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  })

  if (!user) {
    throw new Error("User not found")
  }

  const nextPassword =
    password?.trim() || (user.isAdmin ? "admin123" : "faculty123")

  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(nextPassword, 10) },
  })

  revalidatePath("/dashboard/users")
  return { success: true }
}

export async function deleteUserAccount(userId: string) {
  const session = await auth()
  if (!canManageUsers(session?.user)) {
    throw new Error("Unauthorized")
  }

  if (session?.user?.id === userId) {
    throw new Error("You cannot delete the account you are currently signed in with")
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isAdmin: true,
    },
  })

  if (!user) {
    throw new Error("User not found")
  }

  if (user.isAdmin) {
    const adminCount = await prisma.user.count({
      where: { isAdmin: true },
    })

    if (adminCount <= 1) {
      throw new Error("At least one administrator account must remain")
    }
  }

  await prisma.user.delete({
    where: { id: userId },
  })

  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard/sections")
  revalidatePath("/dashboard/reports")
  return { success: true }
}
