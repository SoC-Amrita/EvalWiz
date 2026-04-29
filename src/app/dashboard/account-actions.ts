"use server"

import { redirect } from "next/navigation"
import prisma from "@/lib/db"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/session"

export async function signOutToLogin() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function changeOwnPassword(formData: FormData) {
  const user = await getSessionUser()

  if (!user?.supabaseId) {
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

  // Verify the current password by attempting a fresh sign-in.
  const supabase = await createSupabaseServerClient()
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (verifyError) {
    throw new Error("Current password is incorrect")
  }

  // Update via the admin client so we don't rely on session state.
  const admin = createSupabaseAdminClient()
  const { error: updateError } = await admin.auth.admin.updateUserById(
    user.supabaseId,
    { password: newPassword }
  )

  if (updateError) {
    throw new Error("Failed to update password. Please try again.")
  }

  return { success: true }
}
