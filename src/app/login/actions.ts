"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Supabase returns "Invalid login credentials" for wrong email/password.
    // Map to a consistent user-facing message.
    if (
      error.message.toLowerCase().includes("invalid login") ||
      error.message.toLowerCase().includes("invalid credentials") ||
      error.message.toLowerCase().includes("email not confirmed")
    ) {
      return { error: "Invalid email or password." }
    }
    return { error: "Something went wrong. Please try again." }
  }

  return { success: true }
}
