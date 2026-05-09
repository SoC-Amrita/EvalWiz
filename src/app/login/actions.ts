"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  let errorMessage: string | null = null

  try {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (!error) {
      return { success: true }
    }

    errorMessage = error.message
  } catch (error) {
    console.error("[login] Supabase client initialization failed:", error)
    return {
      error:
        "Login is temporarily unavailable because Supabase environment variables are missing. Check your Vercel project env vars and redeploy.",
    }
  }

  // Supabase returns "Invalid login credentials" for wrong email/password.
  // Map to a consistent user-facing message.
  const normalizedMessage = errorMessage.toLowerCase()
  if (
    normalizedMessage.includes("invalid login") ||
    normalizedMessage.includes("invalid credentials") ||
    normalizedMessage.includes("email not confirmed")
  ) {
    return { error: "Invalid email or password." }
  }

  return { error: "Something went wrong. Please try again." }
}
