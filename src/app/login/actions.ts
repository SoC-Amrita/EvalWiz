"use server"

import { redirect } from "next/navigation"
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

    if (error) {
      errorMessage = error.message
    }
  } catch (error) {
    console.error("[login] Supabase client initialization failed:", error)
    return {
      error:
        "Login is temporarily unavailable because Supabase environment variables are missing. Check your Vercel project env vars and redeploy.",
    }
  }

  // Success: signInWithPassword has written the session cookie on this action's
  // response, so redirect server-side straight to the dashboard. This replaces a
  // client-side router.push() + router.refresh(), which forced a second full
  // render pass of /dashboard (re-running middleware getUser + layout queries)
  // and produced a visible flash. redirect() must run outside the try/catch —
  // it signals via a thrown control-flow error that catch would otherwise swallow.
  if (errorMessage === null) {
    redirect("/dashboard")
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
