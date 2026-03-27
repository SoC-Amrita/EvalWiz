"use server"

import bcrypt from "bcryptjs"

import { auth, signOut } from "@/auth"
import prisma from "@/lib/db"

export async function signOutToLogin() {
  await signOut({ redirectTo: "/login" })
}

export async function changeOwnPassword(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const currentPassword = String(formData.get("currentPassword") || "").trim()
  const newPassword = String(formData.get("newPassword") || "").trim()
  const confirmPassword = String(formData.get("confirmPassword") || "").trim()

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new Error("Please fill in all password fields")
  }

  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters long")
  }

  if (newPassword !== confirmPassword) {
    throw new Error("New password and confirmation do not match")
  }

  if (currentPassword === newPassword) {
    throw new Error("New password must be different from the current password")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  })

  if (!user) {
    throw new Error("User account not found")
  }

  const isValid = await bcrypt.compare(currentPassword, user.password)

  if (!isValid) {
    throw new Error("Current password is incorrect")
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: await bcrypt.hash(newPassword, 10) },
  })

  return { success: true }
}
