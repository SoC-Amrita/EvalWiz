/**
 * Supabase server-side client for use in Server Components, Server Actions,
 * and Route Handlers. Uses the anon key — respects RLS.
 *
 * setAll is wrapped in try/catch so the same factory works in both
 * Server Components (where cookie writes throw) and Server Actions
 * (where they succeed).
 */

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // In Server Components cookie writes are not allowed;
            // the middleware will refresh the session instead.
          }
        },
      },
    }
  )
}
